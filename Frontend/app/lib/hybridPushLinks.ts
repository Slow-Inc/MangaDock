export type NotificationDestination =
  | { kind: "post" | "profile" | "book" | "forumManga"; id: string }
  | { kind: "collection"; id: string }
  | {
      kind:
        | "home"
        | "account"
        | "wallet"
        | "studio"
        | "staff"
        | "collections"
        | "feed";
    };
export function notificationDestination(
  link: string | null,
): NotificationDestination | null {
  if (link?.startsWith("mangadock://")) {
    try {
      const url = new URL(link);
      if (
        url.username ||
        url.password ||
        url.port ||
        /[\\\u0000-\u001f]/.test(link)
      )
        return null;
      const rawPath = link.split(/[?#]/)[0];
      if (
        rawPath
          .split("/")
          .some((part) => [".", ".."].includes(decodeURIComponent(part)))
      )
        return null;
      link = `/${url.hostname}${url.pathname}`;
      if (!url.hostname) link = url.pathname;
    } catch {
      return null;
    }
  }
  if (
    !link ||
    !link.startsWith("/") ||
    link.startsWith("//") ||
    /[\\\u0000-\u001f]/.test(link)
  )
    return null;
  try {
    if (
      link
        .split(/[?#]/)[0]
        .split("/")
        .some((part) => [".", ".."].includes(decodeURIComponent(part)))
    )
      return null;
    const path = new URL(link, "https://native.invalid").pathname;
    if (path === "/feed" || path === "/feed/") return { kind: "feed" };
    if (path === "/collections" || path === "/collections/")
      return { kind: "collections" };
    const collection = path.match(
      /^\/collections\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i,
    );
    if (collection) return { kind: "collection", id: collection[1] };
    const match = path.match(
      /^\/(community\/p|community\/profile|community\/manga|book)\/([^/]+)(?:\/reviews)?\/?$/,
    );
    if (match) {
      const id = decodeURIComponent(match[2]);
      if (!/^[A-Za-z0-9_-]+$/.test(id) || id === "." || id === "..")
        return null;
      const kind = (
        {
          "community/p": "post",
          "community/profile": "profile",
          "community/manga": "forumManga",
          book: "book",
        } as const
      )[
        match[1] as
          | "community/p"
          | "community/profile"
          | "community/manga"
          | "book"
      ];
      return { kind, id };
    }
    if (path === "/") return { kind: "home" };
    if (
      /^\/settings(?:\/(profile|password|accounts|security|stats|danger))?\/?$/.test(
        path,
      )
    )
      return { kind: "account" };
    if (path === "/studio/wallet") return { kind: "wallet" };
    if (path === "/studio" || path === "/studio/works")
      return { kind: "studio" };
    if (/^\/admin(?:\/(users|content|transactions|audit))?\/?$/.test(path))
      return { kind: "staff" };
    return null;
  } catch {
    return null;
  }
}
