export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  ADMIN_JWT_SECRET?: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === '/debug/env') {
      return Response.json({
        environment: env.ENVIRONMENT,
        has_openai_key: !!env.OPENAI_API_KEY,
        openai_key_length: env.OPENAI_API_KEY?.length || 0,
        has_db: !!env.DB,
        env_keys: Object.keys(env),
      });
    }

    if (url.pathname === '/') {
      return Response.json({
        name: 'lstep-ai-api',
        environment: env.ENVIRONMENT,
        version: '0.1.0',
      });
    }

    if (url.pathname === '/api/ai/test') {
      if (request.method === 'GET') {
        return handleAiTest(new Request(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello' }),
        }), env);
      }
      if (request.method === 'POST') {
        return handleAiTest(request, env);
      }
    }

    return Response.json({ error: 'not found' }, { status: 404 });
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
