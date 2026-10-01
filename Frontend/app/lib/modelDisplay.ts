/**
 * How a translation model id (as reported by the backend, e.g. "deepseek-v4.1-flash")
 * is shown: a short brand for the badge and a readable full name for the hover title.
 */
export type ModelDisplay = { short: string; full: string; title: string };

// Known families, matched against the start of the id's first token.
const BRANDS: Array<[prefix: string, label: string]> = [
  ["gemini", "Gemini"],
  ["gemma", "Gemma"],
  ["deepseek", "DeepSeek"],
  ["qwen", "Qwen"],
  ["kimi", "Kimi"],
  ["glm", "GLM"],
  ["minimax", "MiniMax"],
  ["mimo", "MiMo"],
  ["gpt", "GPT"],
  ["claude", "Claude"],
  ["llama", "Llama"],
  ["mistral", "Mistral"],
  ["grok", "Grok"],
];

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `model` is undefined for translations cached before the backend reported it —
 *  that is shown as a generic "AI", never guessed. */
export function modelDisplay(model: string | null | undefined): ModelDisplay {
  const id = (model ?? "").trim().split("/").pop()?.trim() ?? "";
  if (!id) return { short: "AI", full: "", title: "แปลโดย AI" };

  const [first, ...rest] = id.split(/[-_\s]+/);
  const brand = BRANDS.find(([prefix]) => first.toLowerCase().startsWith(prefix));
  const head = brand
    ? brand[1] + first.slice(brand[0].length) // keep a version glued to the brand: qwen3.8 -> Qwen3.8
    : capitalise(first);
  const full = [head, ...rest.map(capitalise)].join(" ");
  const short = brand ? brand[1] : capitalise(first);

  return { short, full, title: `แปลโดย ${full}` };
}
