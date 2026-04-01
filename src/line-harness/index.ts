/**
 * Bridge file: provides the Env type that all LINE Harness routes expect.
 * This file must exist at src/line-harness/index.ts so that
 * import type { Env } from '../index.js' resolves correctly
 * from src/line-harness/routes/*.ts
 */
export type Env = {
  Bindings: {
    DB: D1Database;
    IMAGES?: R2Bucket;
    LINE_CHANNEL_SECRET?: string;
    LINE_CHANNEL_ACCESS_TOKEN?: string;
    API_KEY?: string;
    LIFF_URL?: string;
    LINE_CHANNEL_ID?: string;
    LINE_LOGIN_CHANNEL_ID?: string;
    LINE_LOGIN_CHANNEL_SECRET?: string;
    WORKER_URL?: string;
    // Our additions
    OPENAI_API_KEY?: string;
    ADMIN_JWT_SECRET?: string;
    ENVIRONMENT?: string;
  };
  Variables: {
    staff: { id: string; name: string; role: 'owner' | 'admin' | 'staff' };
  };
};
