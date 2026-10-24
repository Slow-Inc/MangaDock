import type { BrowseSelection } from "./discovery.ts";
export type NativeTab =
  | "home"
  | "new"
  | "community"
  | "search"
  | "categories"
  | "library";
export function createNativeNavigation() {
  let state: { tab: NativeTab; selection: BrowseSelection | null } = {
    tab: "home",
    selection: null,
  };
  const selections: {
    new: BrowseSelection;
    categories: BrowseSelection | null;
  } = { new: { kind: "new", tab: "new" }, categories: null };
  const listeners = new Set<() => void>();
  const history: NativeTab[] = [];
  const publish = (tab: NativeTab) => {
    state = {
      tab,
      selection: tab === "new" || tab === "categories" ? selections[tab] : null,
    };
    listeners.forEach((listener) => listener());
  };
  return {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(tab: NativeTab) {
      if (tab === state.tab) return;
      history.push(state.tab);
      publish(tab);
    },
    browse(selection: BrowseSelection) {
      const tab = selection.kind === "new" ? "new" : "categories";
      selections[tab] = selection;
      if (tab !== state.tab) history.push(state.tab);
      publish(tab);
    },
    back() {
      const previous = history.pop();
      if (!previous) return false;
      publish(previous);
      return true;
    },
  };
}
