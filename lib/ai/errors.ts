export type AiErrorCode =
  | "PLAN_LIMIT_REACHED"
  | "UNAUTHORIZED"
  | "BAD_INPUT"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR"
  | "RATE_LIMITED";

export interface AiErrorPayload {
  ok: false;
  code: AiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class AiError extends Error {
  code: AiErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(code: AiErrorCode, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toPayload(): AiErrorPayload {
    return {
      ok: false,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function planLimitReached(details: Record<string, unknown>) {
  return new AiError(
    "PLAN_LIMIT_REACHED",
    "You have reached your AI usage limit for the current period.",
    402,
    details,
  );
}

export function unauthorized() {
  return new AiError("UNAUTHORIZED", "Unauthorized", 401);
}

export function badInput(message: string, details?: Record<string, unknown>) {
  return new AiError("BAD_INPUT", message, 400, details);
}

export function providerError(message = "AI provider error", details?: Record<string, unknown>) {
  return new AiError("PROVIDER_ERROR", message, 502, details);
}

export function internalError(message = "Internal error", details?: Record<string, unknown>) {
  return new AiError("INTERNAL_ERROR", message, 500, details);
}

export function rateLimited(message: string, details?: Record<string, unknown>) {
  return new AiError("RATE_LIMITED", message, 429, details);
}
