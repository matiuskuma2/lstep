import { SYSTEM_PROMPT_V1 } from './prompts';
import type { AiChatRequest, AiChatResponse, ChatMessage } from './types';
import type { Bot, KnowledgeItem } from '../adapters/bot-knowledge';
import type { KnowledgeChunk } from '../adapters/knowledge-chunk';

export interface BotKnowledgeContext {
  bot?: Bot;
  knowledge?: KnowledgeItem[];
  chunks?: KnowledgeChunk[];
}

export async function generatePlan(
  request: AiChatRequest,
  apiKey: string,
  botKnowledge?: BotKnowledgeContext,
): Promise<AiChatResponse> {
  let systemPrompt = SYSTEM_PROMPT_V1;

  if (botKnowledge?.bot) {
    const b = botKnowledge.bot;
    if (b.system_prompt) {
      systemPrompt += '\n\n[Bot System Prompt]\n' + b.system_prompt;
    }
    if (b.description) {
      systemPrompt += '\n\n[Bot Description]\n' + b.description;
    }
  }

  // Inject knowledge chunks (Phase 1: all chunks; Phase 2: embedding-based)
  if (botKnowledge?.chunks && botKnowledge.chunks.length > 0) {
    systemPrompt += '\n\n[Knowledge Context]\nUse the following knowledge chunks to inform your responses:\n';
    for (const chunk of botKnowledge.chunks) {
      systemPrompt += '\n---\n' + chunk.chunk_text + '\n';
    }
  } else if (botKnowledge?.knowledge && botKnowledge.knowledge.length > 0) {
    // Fallback: use full knowledge content if no chunks exist
    systemPrompt += '\n\n[Knowledge Context]\nUse the following knowledge to inform your responses:\n';
    for (const k of botKnowledge.knowledge) {
      systemPrompt += '\n--- ' + k.title + ' [' + k.category + '] ---\n' + k.content + '\n';
    }
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  if (request.history) {
    for (const msg of request.history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // Build current user message with context
  let userContent = '';
  if (request.context?.line_account_id) {
    userContent += `[Context: LINE account = ${request.context.line_account_id}]\n\n`;
  }
  if (request.accumulated_slots && request.accumulated_slots.length > 0) {
    const filled = request.accumulated_slots.filter(s => s.value != null);
    if (filled.length > 0) {
      userContent += '[Previously confirmed slots: ' +
        filled.map(s => `${s.name}=${JSON.stringify(s.value)}`).join(', ') +
        ']\n\n';
    }
  }
  userContent += request.message;

  messages.push({ role: 'user', content: userContent });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content || '';

  let parsed: AiChatResponse;
  try {
    parsed = JSON.parse(content) as AiChatResponse;
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${content.substring(0, 200)}`);
  }

  parsed.raw_message = request.message;

  // Merge accumulated slots with newly extracted
  if (request.accumulated_slots) {
    const newSlotNames = new Set(parsed.slots.filter(s => s.value != null).map(s => s.name));
    for (const accSlot of request.accumulated_slots) {
      if (accSlot.value != null && !newSlotNames.has(accSlot.name)) {
        parsed.slots.push(accSlot);
      }
    }
  }

  // Recalculate is_complete based on actual filled slots
  const filledNames = new Set(parsed.slots.filter(s => s.value != null).map(s => s.name));
  parsed.missing_slots = parsed.missing_slots.filter(s => !filledNames.has(s.name));
  parsed.is_complete = parsed.missing_slots.length === 0;

  return parsed;
}
