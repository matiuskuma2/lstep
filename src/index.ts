import { generatePlan } from './ai/engine';
import type { AiChatRequest } from './ai/types';

export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  ADMIN_JWT_SECRET?: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for admin UI
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let response: Response;

    if (url.pathname === '/health') {
      response = Response.json({
        status: 'ok',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      });
    } else if (url.pathname === '/debug/env') {
      response = Response.json({
        environment: env.ENVIRONMENT,
        has_openai_key: !!env.OPENAI_API_KEY,
        openai_key_length: env.OPENAI_API_KEY?.length || 0,
        has_db: !!env.DB,
        env_keys: Object.keys(env),
      });
    } else if (url.pathname === '/') {
      response = Response.json({
        name: 'lstep-ai-api',
        environment: env.ENVIRONMENT,
        version: '0.2.0',
      });
    } else if (url.pathname === '/api/ai/test') {
      if (request.method === 'GET') {
        response = await handleAiTest(new Request(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        }), env);
      } else if (request.method === 'POST') {
        response = await handleAiTest(request, env);
      } else {
        response = Response.json({ error: 'method not allowed' }, { status: 405 });
      }
    } else if (url.pathname === '/api/ai/chat') {
      if (request.method === 'GET') {
        response = await handleAiChat(new Request(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: url.searchParams.get('q') || '新規友だち向けに3日ステップを作って',
          }),
        }), env);
      } else if (request.method === 'POST') {
        response = await handleAiChat(request, env);
      } else {
        response = Response.json({ error: 'method not allowed' }, { status: 405 });
      }
    } else {
      response = Response.json({ error: 'not found' }, { status: 404 });
    }

    // Add CORS headers to all responses
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};

async function handleAiTest(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return Response.json(
      { status: 'error', message: 'OPENAI_API_KEY not configured' },
      { status: 503 }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: 'error', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const userMessage = body.message || 'hello';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for LINE step delivery operations. Reply briefly in the same language as the user.',
          },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return Response.json(
        { status: 'error', message: `OpenAI API error: ${response.status}`, detail: errorText },
        { status: 502 }
      );
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    return Response.json({
      status: 'ok',
      response: data.choices[0]?.message?.content || '',
      usage: data.usage,
    });
  } catch (err) {
    return Response.json(
      { status: 'error', message: `Request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}

async function handleAiChat(request: Request, env: Env): Promise<Response> {
  if (!env.OPENAI_API_KEY) {
    return Response.json(
      { status: 'error', message: 'OPENAI_API_KEY not configured' },
      { status: 503 }
    );
  }

  let body: AiChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: 'error', message: 'Invalid JSON body. Expected: { \"message\": \"...\", \"context\": { \"line_account_id\": \"...\" } }' },
      { status: 400 }
    );
  }

  if (!body.message) {
    return Response.json(
      { status: 'error', message: 'Missing required field: message' },
      { status: 400 }
    );
  }

  try {
    const plan = await generatePlan(body, env.OPENAI_API_KEY);
    return Response.json({ status: 'ok', ...plan });
  } catch (err) {
    return Response.json(
      { status: 'error', message: `Plan generation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
