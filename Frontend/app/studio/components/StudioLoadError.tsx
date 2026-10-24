"use client";

import LoadError from "../../components/ui/LoadError";

/** A failed Studio load (#828): the shared LoadError (#911) with the Studio mascot. */
export default function StudioLoadError({ what, onRetry }: { what: string; onRetry: () => unknown }) {
  return <LoadError what={what} onRetry={onRetry} area="studio" />;
}
