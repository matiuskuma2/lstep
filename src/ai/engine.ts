import { SYSTEM_PROMPT_V1 } from './prompts';
import type { AiChatRequest, AiChatResponse } from './types';

export async function generatePlan(
  request: AiChatRequest,
  apiKey: string,
): Promise<AiChatResponse> {
  const userContent = request.context?.line_account_id
    ? `[Context: LINE account = ${request.context.line_account_id}]\n\n${request.message}`
    : request.message;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_V1 },
        { role: 'user', content: userContent },
      ],
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
  return parsed;
}
