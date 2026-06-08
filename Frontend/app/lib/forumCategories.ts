import type { ForumCategory } from "./types/forum";

const ALL_CATEGORIES: readonly ForumCategory[] = [
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
  if (PRIVILEGED_ROLES.has(role ?? "")) return [...ALL_CATEGORIES];
  return ALL_CATEGORIES.filter((cat) => !RESTRICTED.has(cat));
}
