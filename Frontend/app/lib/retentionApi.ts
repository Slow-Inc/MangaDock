import { supabase } from "./supabase";
import { createAuthHeaders } from "./apiUtils";
import { HttpError } from "./httpError";
import type { ForumPost } from "./types";

export type ReadingCollection = {
  id: string;
  owner_uid: string;
  name: string;
  description: string;
  visibility: "public" | "private";
  created_at: string;
  updated_at: string;
};
export type CollectionDetail = ReadingCollection & {
  items: { manga_id: string; title: string; added_at: string }[];
};
export type CollectionInput = Pick<
  ReadingCollection,
  "name" | "description" | "visibility"
>;

async function request<T>(
  path: string,
  uid: string | null,
  init: RequestInit = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (uid && session?.user.id !== uid)
    throw new Error("บัญชีเปลี่ยนแล้ว กรุณาลองอีกครั้ง");
  const response = await fetch(`/api/proxy/${path}`, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: createAuthHeaders(uid ? session?.access_token : null, {
      "Content-Type": "application/json",
    }),
  });
  if (!response.ok)
    throw new HttpError(
      response.status,
      "ไม่สามารถทำรายการได้ กรุณาลองอีกครั้ง",
    );
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

export const retentionApi = {
  feed: (uid: string, mode: "following" | "personalized", offset = 0) =>
    request<{ items: ForumPost[]; total: number }>(
      `feed?mode=${mode}&offset=${offset}&limit=20`,
      uid,
    ),
  collections: (uid: string) =>
    request<ReadingCollection[]>("collections", uid),
  collection: (id: string, uid: string | null) =>
    request<CollectionDetail>(
      `collections/${uid ? "" : "public/"}${encodeURIComponent(id)}`,
      uid,
    ),
  save: (uid: string, input: CollectionInput, id?: string) =>
    request<ReadingCollection>(
      `collections${id ? `/${encodeURIComponent(id)}` : ""}`,
      uid,
      { method: id ? "PUT" : "POST", body: JSON.stringify(input) },
    ),
  remove: (uid: string, id: string) =>
    request<void>(`collections/${encodeURIComponent(id)}`, uid, {
      method: "DELETE",
    }),
  item: (
    uid: string,
    id: string,
    mangaId: string,
    title: string,
    remove = false,
  ) =>
    request<void>(`collections/${encodeURIComponent(id)}/items`, uid, {
      method: remove ? "DELETE" : "PUT",
      body: JSON.stringify({ mangaId, title }),
    }),
};
