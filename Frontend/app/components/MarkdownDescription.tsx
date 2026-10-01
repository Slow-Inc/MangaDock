import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Descriptions come from external catalogs (MangaDex) and LLM output, i.e. untrusted:
// react-markdown never emits raw HTML and drops unsafe URL schemes (javascript:, data:)
// by default; images are removed on top of that so a description can't load remote assets.
// A description's headings are body text here, not page headings.
const Heading: Components["h1"] = ({ children }) => (
  <p className="font-semibold text-white/90">{children}</p>
);

const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-words text-sky-300 underline underline-offset-2 transition-colors hover:text-sky-200"
    >
      {children}
    </a>
  ),
  img: () => null,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
  hr: () => <hr className="my-1 border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-white/15 pl-3 text-white/60">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">{children}</code>
  ),
};

/** Full markdown rendering of a book description (detail modal). */
export default function MarkdownDescription({ text }: { text: string }) {
  return (
    <div className="space-y-2 break-words text-sm leading-relaxed text-white/75">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
