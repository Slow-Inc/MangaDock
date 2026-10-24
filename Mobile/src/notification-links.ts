export type NotificationDestination =
  | { kind: "post" | "profile" | "book" | "forumManga"; id: string }
  | { kind: "home" | "account" | "wallet" | "studio" | "staff" };
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
    const path = new URL(link, "https://native.invalid").pathname;
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
          "community/p" | "community/profile" | "community/manga" | "book"
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
