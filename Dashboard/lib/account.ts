// Pure logic for the Dashboard's account-linking panel (PRD #279, ADR 016 role
// model). The dashboard is standalone, so it carries its OWN multi-provider
// linking (Supabase identity API) rather than depending on the Frontend: a
// moderator signs in with Google, a dev links GitHub, an admin can hold both.
// Unit-tested in account.test.ts; the Supabase side-effects live in the panel.

export interface Identity {
  identity_id: string;
  provider: string;
}

export interface SupportedProvider {
  provider: string;
  label: string;
}

export interface ConnectionRow {
  provider: string;
  label: string;
  linked: boolean;
  identityId: string | undefined;
  canUnlink: boolean;
}

/** One row per supported provider (in `supported` order): whether it's linked,
 * its identity id (for unlink), and whether it may be unlinked — never the only
 * remaining identity, so a user can't lock themselves out. */
export function accountConnections(identities: Identity[], supported: SupportedProvider[]): ConnectionRow[] {
  return supported.map(({ provider, label }) => {
    const identity = identities.find((i) => i.provider === provider);
    const linked = identity !== undefined;
    return {
      provider,
      label,
      linked,
      identityId: identity?.identity_id,
      canUnlink: linked && identities.length > 1,
    };
  });
}
