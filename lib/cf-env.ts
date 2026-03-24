import { getRequestContext } from "@cloudflare/next-on-pages";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; error?: string }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface CfEnv {
  DB?: D1Database;
  RESEND_API_KEY?: string;
  [key: string]: unknown;
}

export async function getCfEnv(): Promise<CfEnv> {
  try {
    const ctx = getRequestContext();
    return ctx.env as unknown as CfEnv;
  } catch {
    return {};
  }
}
