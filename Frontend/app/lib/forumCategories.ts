import type { ForumCategory } from "./types/forum";

export const CATEGORY_LIST: readonly ForumCategory[] = [
  "general",
  "announcement",
  "spoiler",
  "manga_update",
];

const RESTRICTED: ReadonlySet<ForumCategory> = new Set(["announcement", "manga_update"]);

const PRIVILEGED_ROLES = new Set(["translator", "creator", "admin"]);

export function isRestrictedCategory(cat: ForumCategory): boolean {
  return RESTRICTED.has(cat);
}

export function availableCategories(role: string | null | undefined): ForumCategory[] {
  if (PRIVILEGED_ROLES.has(role ?? "")) return [...CATEGORY_LIST];
  return CATEGORY_LIST.filter((cat) => !RESTRICTED.has(cat));
}
