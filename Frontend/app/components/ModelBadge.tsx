import { modelDisplay } from "../lib/modelDisplay";

// "Translated by AI" badge: short brand (e.g. DeepSeek); hover shows the full model name.
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
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={small ? "h-2.5 w-2.5" : "h-3 w-3"}
        aria-hidden
      >
        <path d="M12 2C6.29 9.5 2 10.5 2 12c0 1.5 4.29 2.5 10 10 5.71-7.5 10-8.5 10-10 0-1.5-4.29-2.5-10-10z" />
      </svg>
      {short}
    </span>
  );
}
