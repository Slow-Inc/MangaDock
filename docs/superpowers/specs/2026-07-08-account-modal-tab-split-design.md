# Design: AccountModal Tab Split + Reducer (#585)

**Date:** 2026-07-08  
**Issue:** [#585](https://github.com/Slow-Inc/MangaDock/issues/585)  
**Parent story:** #565 (Frontend Grooming F3)

---

## Goal

Split `Frontend/app/components/AccountModal.tsx` (1,383 lines) into four focused tab children, hoist shared form state into a small reducer, and remove all three `exhaustive-deps` suppressions.

**Done when:**
- Four tab child files extracted; parent is an orchestrator only
- `useReducer` manages `{ loading, successMessage, errorMessage }`
- 0 `// eslint-disable-next-line react-hooks/exhaustive-deps` lines remain
- Account flows unchanged (no behaviour change)

---

## Architecture

### Files

| File | Role |
|------|------|
| `Frontend/app/components/AccountModal.tsx` | Orchestrator: nav state, modal chrome, reducer, tab routing |
| `Frontend/app/components/account/ProfileTab.tsx` | New — profile name + photo picker |
| `Frontend/app/components/account/PasswordTab.tsx` | New — change password |
| `Frontend/app/components/account/AccountsTab.tsx` | New — link/unlink Google/Facebook/email |
| `Frontend/app/components/account/DangerTab.tsx` | New — delete account (reauth → confirm) |

### Reducer (in AccountModal.tsx)

```ts
type FormState = {
  loading: boolean;
  successMessage: string | null;
  errorMessage: string | null;
};

type FormAction =
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_SUCCESS"; message: string }
  | { type: "SET_ERROR"; message: string }
  | { type: "CLEAR" };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_LOADING": return { ...state, loading: action.value };
    case "SET_SUCCESS": return { ...state, loading: false, successMessage: action.message, errorMessage: null };
    case "SET_ERROR":   return { ...state, loading: false, successMessage: null, errorMessage: action.message };
    case "CLEAR":       return { loading: false, successMessage: null, errorMessage: null };
  }
}
```

### State ownership

| State | Owner |
|-------|-------|
| `mounted`, `visible`, `tab`, `pageView`, `panelHeight` | AccountModal (nav/chrome) |
| `loading`, `successMessage`, `errorMessage` | AccountModal via `formReducer` |
| `displayName`, `email`, `showPhotoPicker`, `previousPhotos`, `photoUploading`, `photoError` | ProfileTab (local) |
| `currentPassword`, `newPassword`, `confirmPassword` | PasswordTab (local) |
| `linking`, `linkingResolvedRef` | AccountsTab (local) |
| `deleteStep`, `deleteConfirmText`, `reauthPassword`, `reauthenticating`, `reauthResolvedRef`, `sendingVerification` | DangerTab (local) |

### Props contract (tab children)

Each tab receives:
```ts
interface TabProps {
  formState: FormState;        // { loading, successMessage, errorMessage }
  dispatch: React.Dispatch<FormAction>;
  onClose: () => void;         // for post-action close (e.g. delete)
}
```

Plus tab-specific data (e.g. `ProfileTab` also gets initial `user` data via `useAuth()` directly — tabs call `useAuth()` themselves for auth methods, avoiding prop-drilling of 15+ auth functions).

### tabRefs stabilisation

```ts
// Stabilise so the panel-height effect's dep array is correct
const tabRefs = useMemo<Record<Tab, React.RefObject<HTMLDivElement | null>>>(
  () => ({ profile: profileRef, password: passwordRef, accounts: accountsRef, danger: dangerRef }),
  [] // refs are stable objects — empty dep array is correct
);
```

---

## exhaustive-deps Fix Plan

| Line | Effect deps (current) | Missing | Fix |
|------|----------------------|---------|-----|
| 121 | `[isOpen, initialTab, asPage]` | `router`, `onClose` | `router` is stable (Next.js guarantees); add `onClose` (callers already use `useCallback`) |
| 131 | `[isOpen, visible, tab, asPage, …state vars…]` | `tabRefs` | Stabilise `tabRefs` with `useMemo` (above) → safe to add |
| 142 | `[user, isOpen]` | `getPhotoHistory` | Verify `getPhotoHistory` is `useCallback`-wrapped in AuthContext; if yes, add to deps; if not, wrap it there first |

---

## Data Flow

```
AccountModal
  ├── formReducer  ──► { loading, successMessage, errorMessage }
  ├── nav state    ──► tab, visible, pageView, panelHeight
  │
  ├── <ProfileTab  formState dispatch onClose />
  ├── <PasswordTab formState dispatch onClose />
  ├── <AccountsTab formState dispatch onClose />
  └── <DangerTab   formState dispatch onClose />
```

Shared `successMessage`/`errorMessage` banner is rendered by AccountModal (not by individual tabs), so it naturally persists above the tab area regardless of which tab is active.

---

## What Does NOT Change

- No behaviour change — same user-visible flows
- `TabType`, `TAB_ORDER`, tab routing logic unchanged
- `panelHeight` animation logic unchanged
- `resetTransientState` moves to AccountModal; still called on close/tab-switch

---

## Testing

- `bun test` (Frontend unit tests) must pass green after refactor
- `bun lint` must pass with 0 exhaustive-deps suppressions
- Manual smoke: open modal → each tab flow (update name, change password, link/unlink, delete account cancel) works unchanged
