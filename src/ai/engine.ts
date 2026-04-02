import { SYSTEM_PROMPT_V2 } from './prompts';
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
  let systemPrompt = SYSTEM_PROMPT_V2;

  if (botKnowledge?.bot) {
    const b = botKnowledge.bot;
    if (b.system_prompt) {
      systemPrompt += '\n\n[Bot System Prompt]\n' + b.system_prompt;
    }
    if (b.description) {
      systemPrompt += '\n\n[Bot Description]\n' + b.description;
    }
  }

  // Inject knowledge chunks for RAG
  if (botKnowledge?.chunks && botKnowledge.chunks.length > 0) {
    systemPrompt += '\n\n[Knowledge Context]\n以下のナレッジを参考にして応答してください:\n';
    for (const chunk of botKnowledge.chunks) {
      systemPrompt += '\n---\n' + chunk.chunk_text + '\n';
    }
  } else if (botKnowledge?.knowledge && botKnowledge.knowledge.length > 0) {
    systemPrompt += '\n\n[Knowledge Context]\n以下のナレッジを参考にして応答してください:\n';
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
    userContent += `[Context: LINE account = ${request.context.line_account_id}]\n`;
  }
  if (request.context?.tenant_id) {
    userContent += `[Context: tenant = ${request.context.tenant_id}]\n`;
  }
  if (userContent) userContent += '\n';
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
      max_tokens: 2000,
      temperature: 0.3,
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

  // Strip markdown code fences if present
  const cleaned = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

  let parsed: AiChatResponse;
  try {
    parsed = JSON.parse(cleaned) as AiChatResponse;
  } catch {
    // If JSON parse fails, return as general_question with the raw text
    parsed = {
      intent: 'general_question',
      confidence: 0.5,
      proposal: null,
      questions: [],
      is_ready: false,
      display_message: content,
    };
  }

  parsed.raw_message = request.message;

  // Ensure required fields have defaults
  if (!parsed.intent) parsed.intent = 'unknown';
  if (!parsed.questions) parsed.questions = [];
  if (parsed.is_ready === undefined) parsed.is_ready = false;
  if (!parsed.display_message) parsed.display_message = parsed.proposal?.summary || '';

  return parsed;
}
