export interface AiClientErrorPayload {
  ok?: false;
  code?: string;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export function extractAiError(payload: AiClientErrorPayload, fallback: string): string {
  if (typeof payload?.message === "string" && payload.message.trim()) return payload.message;
  if (typeof payload?.error === "string" && payload.error.trim()) return payload.error;
  return fallback;
}

export function isPlanLimitError(payload: AiClientErrorPayload): boolean {
  return payload?.code === "PLAN_LIMIT_REACHED" || payload?.code === "FREE_LIMIT_REACHED";
}
