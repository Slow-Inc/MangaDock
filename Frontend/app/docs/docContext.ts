'use client';

import { createContext, useContext } from 'react';
import type { ViewState } from './routes';

/** Renders the part of the document that holds heading `id`, if it is not on the page yet; resolves once it is. */
export type Reveal = (id: string) => Promise<void>;

/**
 * Where the Markdown being rendered lives. A repository document provides it, so its relative links and
 * images can be resolved the way GitHub does and a link to another document stays inside the site.
 * Text that is not from the repository (an issue or pull request body, written by anyone) renders without
 * it, and is treated as untrusted: it never loads an image from another host.
 */
export interface DocContextValue {
  /** Repository path of the file being shown, e.g. `docs/adr/001-x.md`. */
  file: string;
  /** Every document the site shows. */
  docPaths: ReadonlySet<string>;
  navigate: (v: ViewState) => void;
  reveal?: Reveal;
}

export const DocContext = createContext<DocContextValue | null>(null);
export const useDocContext = () => useContext(DocContext);
