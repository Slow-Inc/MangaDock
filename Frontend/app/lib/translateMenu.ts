/**
 * Translate menu model (#162).
 *
 * Single source of truth for which translate-related items the Reader's
 * translate menus (desktop dropdown + mobile sheet) show. Keeping the
 * decision pure keeps the two menus from drifting apart and makes the
 * fully-translated behavior unit-testable: when every page is done, the
 * translate buttons disappear and one view toggle remains — never a
 * translate button that silently does nothing.
 */

export type TranslateMenuModel = {
  /** Render "แปลหน้านี้" + "แปลทั้งตอน"? Hidden once the chapter is fully translated. */
  showTranslateButtons: boolean;
  /** Label of the view-toggle item, or null to hide it. */
  viewToggleLabel: "ดูต้นฉบับ" | "ดูฉบับแปล" | null;
};

export function buildTranslateMenu(state: {
  totalPages: number;
  completedCount: number;
  hasAnyTranslation: boolean;
  showTranslation: boolean;
}): TranslateMenuModel {
  const full = state.totalPages > 0 && state.completedCount >= state.totalPages;
  if (full) {
    return {
      showTranslateButtons: false,
      viewToggleLabel: state.showTranslation ? "ดูต้นฉบับ" : "ดูฉบับแปล",
    };
  }
  return {
    showTranslateButtons: true,
    // While translating is still possible, the translate buttons themselves
    // re-enable the translation view, so the toggle's only remaining job is
    // the way OUT — it renders only while the translation view is on.
    viewToggleLabel: state.hasAnyTranslation && state.showTranslation ? "ดูต้นฉบับ" : null,
  };
}
