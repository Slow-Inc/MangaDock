/**
 * Whether a key event comes from a place the user types text — a text field, a select, an editable element. Page-wide
 * shortcuts (the reader's arrow keys) must leave its keys alone, or moving the cursor turns the page (#928).
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as { tagName?: unknown; isContentEditable?: boolean } | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable === true || el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}
