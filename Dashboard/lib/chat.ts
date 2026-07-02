/** Routes a dev's free-text question to the dashboard topic it's about, so the assistant can
 *  ground its answer in the right data (logs, metrics, panels). Pure — unit-tested in chat.test.ts.
 *  In production this routing hint is sent alongside the full dashboard context to qwen3.6 · 9arm. */

export type ChatTopic = "pipeline" | "translate" | "oauth" | "payment" | "node" | "traffic" | "backend" | "general";

const RULES: [ChatTopic, RegExp][] = [
  ["pipeline", /vram|gpu mem(ory)?|\bmemory\b|pipeline|\bstages?\b|กิน|แต่ละ\s*(ตัว|model|โมเดล)|ราย\s*model/i],
  ["translate", /translate|\bmit\b|9arm|qwen|inference|ocr|inpaint/i],
  ["oauth", /oauth|login|sign[- ]?in|google|facebook|supabase auth|token refresh/i],
  ["payment", /payment|omise|\bpay\b|coin|wallet|top[- ]?up|unlock|revenue/i],
  ["node", /node|cluster|be-[0-9a-f]|leader|lease|heartbeat|stale|quorum/i],
  ["traffic", /\buser|traffic|bandwidth|active|online|sessions/i],
  ["backend", /backend|cache|redis|write|flush|l1|l2|l3|dirty|supabase/i],
];

export function routeChat(text: string): ChatTopic {
  for (const [topic, re] of RULES) {
    if (re.test(text)) return topic;
  }
  return "general";
}
