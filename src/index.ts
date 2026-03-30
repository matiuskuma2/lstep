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

    if (url.pathname === '/') {
      return Response.json({
        name: 'lstep-ai-api',
        environment: env.ENVIRONMENT,
        version: '0.1.0',
      });
    }

    return Response.json({ error: 'not found' }, { status: 404 });
  },
};
