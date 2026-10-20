/** Which loader each kind of wait gets, so the same wait always looks the same across the app. */
export type LoaderContext = "page" | "section" | "inline" | "translate";
export type LoaderSpec = { kind: "atom" | "arc" | "slide"; size: number };

const SPECS: Record<LoaderContext, LoaderSpec> = {
  page: { kind: "atom", size: 40 },
  section: { kind: "atom", size: 28 },
  inline: { kind: "arc", size: 16 },
  translate: { kind: "slide", size: 24 },
};

export function loaderFor(context: LoaderContext): LoaderSpec {
  return SPECS[context];
}
