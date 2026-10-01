import { modelDisplay } from "../lib/modelDisplay";

// "Translated by AI" badge: short brand (e.g. DeepSeek); hover shows the full model name.
// The marker is a neutral dot on purpose: the badge names many vendors, so it must not
// borrow any one of their logos.
export default function ModelBadge({
  model,
  small = false,
}: {
  model?: string | null;
  small?: boolean;
}) {
  const { short, title } = modelDisplay(model);
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 font-medium text-white/70 ${
        small ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      <span aria-hidden className={`rounded-full bg-current opacity-60 ${small ? "h-1 w-1" : "h-1.5 w-1.5"}`} />
      {short}
    </span>
  );
}
