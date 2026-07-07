import { buildDashboardContext } from "@/lib/dashboard-context";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Proxies the dev's chat to the 9arm gateway (qwen3.6), grounding it in the full dashboard
 *  context server-side so the API key never reaches the browser. Returns { reply } on success
 *  or { error } (always HTTP 200) so the client can fall back to the built-in mock answers. */
export async function POST(req: Request) {
  const base = process.env.LLM_BASE_URL;
  const key = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!base || !key || !model) return Response.json({ error: "not-configured" });

  let body: { messages?: ChatMessage[]; lang?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad-request" });
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const lang = body.lang === "th" ? "Thai (keep technical terms in English)" : "English";

  const system =
    `You are an SRE assistant embedded in the MIT translation-pipeline dashboard. Answer the developer's ` +
    `question grounded ONLY in the live dashboard state below — cite specific log lines, numbers, node ids, ` +
    `and stages. Be concise and technical. If the answer is not in the data, say so plainly. Respond in ${lang}.\n\n` +
    buildDashboardContext();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.3, max_tokens: 700, messages: [{ role: "system", content: system }, ...messages] }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return Response.json({ error: `gateway-${r.status}` });
    const data = await r.json();
    const reply: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return reply ? Response.json({ reply }) : Response.json({ error: "empty" });
  } catch {
    clearTimeout(timer);
    return Response.json({ error: "gateway-unreachable" });
  }
}
