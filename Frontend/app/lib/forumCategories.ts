import type { ForumCategory } from "./types/forum";

export const CATEGORY_LIST: readonly ForumCategory[] = [
  "general",
  "announcement",
  "spoiler",
  "manga_update",
];

const RESTRICTED: ReadonlySet<ForumCategory> = new Set(["announcement", "manga_update"]);

export function isRestrictedCategory(cat: ForumCategory): boolean {
  return RESTRICTED.has(cat);
}

export function availableCategories(role: number | null | undefined): ForumCategory[] {
  const r = role ?? 0;
  return CATEGORY_LIST.filter(cat => {
    if (cat === 'announcement') return r >= 8;   // admin/dev only
    if (cat === 'manga_update') return r >= 1;   // translator+
    return true;
  });
}
