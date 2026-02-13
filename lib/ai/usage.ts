import type { SupabaseClient } from "@supabase/supabase-js";

interface LogAiUsageInput {
  userId: string;
  route: string;
  request_tokens?: number;
  response_tokens?: number;
  total_tokens?: number;
  cost_estimate?: number;
}

export async function logAiUsage(supabase: SupabaseClient, input: LogAiUsageInput): Promise<void> {
  await supabase.from("ai_usage").insert({
    user_id: input.userId,
    route: input.route,
    request_tokens: input.request_tokens ?? 0,
    response_tokens: input.response_tokens ?? 0,
    total_tokens: input.total_tokens ?? 0,
    cost_estimate: input.cost_estimate ?? 0,
  });
}
