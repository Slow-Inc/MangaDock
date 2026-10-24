import { ApiError, createApi } from "./api.ts";
import { createMedia, validateImage, type PickedImage } from "./media.ts";
import type { createMobileSession } from "./session.ts";
export type ChapterVersion = {
  versionId: string;
  titleId: string;
  titleName: string;
  titleAltName?: string;
  chapterId: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  translatorUid: string;
  translatorName: string | null;
  status: "draft" | "pending_moderation" | "published" | "rejected";
  pages: string[];
  priceCoins: number;
  qualityScore: number;
  isDefault: boolean;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  backendAvailable?: boolean;
};
export type VersionDraft = {
  titleId: string;
  titleName: string;
  titleAltName?: string;
  chapterId?: string;
  chapterNumber: string;
  chapterTitle: string;
  language: string;
  description?: string;
  priceCoins?: number;
};
export type VersionMetadata = {
  description?: string;
  priceCoins?: number;
  titleAltName?: string;
  chapterTitle?: string;
  chapterNumber?: string;
};
export type PageUpload = {
  image: PickedImage;
  status: "pending" | "sending" | "uploaded" | "error" | "uncertain";
  error: string | null;
  pageUrl?: string;
};
export type CreatorEarnings = {
  totalSales: number;
  totalEarned: number;
  titlesSold: number;
  uniqueBuyers: number;
};
export function createStudio(options: {
  apiOrigin: string;
  deviceId: string;
  fetch: typeof globalThis.fetch;
  session: ReturnType<typeof createMobileSession>;
}) {
  const api = createApi(options);
  const media = createMedia(options);
  let state = {
    versions: [] as ChapterVersion[],
    version: null as ChapterVersion | null,
    loading: false,
    error: null as string | null,
    creationUncertain: false,
    uploading: false,
    uploads: [] as PageUpload[],
    earnings: null as CreatorEarnings | null,
    earningsLoading: false,
    earningsError: null as string | null,
  };
  const listeners = new Set<() => void>(),
    requests = new Set<AbortController>();
  const publish = (next: typeof state) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const accountKey = () => {
    const account = options.session.snapshot().account;
    return account ? `${account.uid}:${account.role}` : null;
  };
  let identity = 0,
    owner = accountKey(),
    loadGeneration = 0,
    earningsGeneration = 0,
    view = 0;
  let creation: Promise<ChapterVersion | null> | null = null;
  let processing: Promise<void> | null = null;
  let queueing: Promise<void> | null = null;
  const identityChanged = () => {
    const next = accountKey();
    if (next !== owner) {
      owner = next;
      identity++;
      view++;
      creation = null;
      processing = null;
      queueing = null;
      loadGeneration++;
      earningsGeneration++;
      media.dispose();
      requests.forEach((request) => request.abort());
      publish({
        versions: [],
        version: null,
        loading: false,
        error: null,
        creationUncertain: false,
        uploading: false,
        uploads: [],
        earnings: null,
        earningsLoading: false,
        earningsError: null,
      });
    }
  };
  let unsubscribe: (() => void) | undefined =
    options.session.subscribe(identityChanged);
  async function request(
    path: string,
    init: RequestInit = {},
    creatorOnly = true,
  ) {
    const epoch = identity,
      token = await options.session.accessToken();
    if (epoch !== identity || !unsubscribe) return null;
    if (
      creatorOnly &&
      ![1, 2, 8].includes(Number(options.session.snapshot().account?.role))
    )
      throw new Error("Studio สำหรับนักแปลและผู้สร้างที่มีสิทธิ์");
    const controller = new AbortController();
    requests.add(controller);
    try {
      const response = await api.request(path, {
        ...init,
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      return epoch === identity && !controller.signal.aborted ? response : null;
    } finally {
      requests.delete(controller);
    }
  }
  async function refreshVersion(id: string, epoch: number, current: number) {
    const response = await request(`versions/${encodeURIComponent(id)}`);
    if (!response) return;
    const version = (await response.json()) as ChapterVersion;
    if (epoch !== identity || current !== view) return;
    if (version.translatorUid !== options.session.snapshot().account?.uid)
      throw new Error("ข้อมูลผู้สร้างไม่ตรงกับบัญชี");
    loadGeneration++;
    publish({
      ...state,
      version,
      versions: [
        version,
        ...state.versions.filter((item) => item.versionId !== id),
      ],
    });
  }
  function selectedVersion() {
    if (processing || queueing || creation)
      throw new Error("รอรายการปัจจุบันก่อน");
    const version = state.version;
    if (
      !version ||
      version.translatorUid !== options.session.snapshot().account?.uid
    )
      throw new Error("เลือกผลงานของคุณก่อน");
    return version;
  }
  async function pageMutation(
    body: { pages: string[] } | { pageUrl: string },
    method: "PUT" | "DELETE",
  ) {
    const version = selectedVersion(),
      epoch = identity,
      current = view;
    if (!["draft", "published"].includes(version.status))
      throw new Error("สถานะนี้ยังแก้ pages ไม่ได้");
    const response = await request(
      `upload/versions/${encodeURIComponent(version.versionId)}/pages`,
      { method, body: JSON.stringify(body) },
    );
    if (!response || epoch !== identity || current !== view) return false;
    await refreshVersion(version.versionId, epoch, current);
    return true;
  }
  function uploadPending(): Promise<void> {
    if (processing) return processing;
    const epoch = identity,
      current = view,
      id = state.version?.versionId;
    if (!id) return Promise.reject(new Error("เลือก draft ก่อนอัปโหลด"));
    publish({ ...state, uploading: true, error: null });
    const promise = (async () => {
      for (let index = 0; index < state.uploads.length; index++) {
        if (epoch !== identity || current !== view) return;
        const upload = state.uploads[index];
        if (upload.status === "uploaded") continue;
        if (upload.status === "uncertain") break;
        publish({
          ...state,
          uploads: state.uploads.map((item, offset) =>
            offset === index
              ? { ...item, status: "sending", error: null }
              : item,
          ),
        });
        try {
          const result = await media.upload<{
            pageUrl: string;
            pageIndex: number;
          }>(
            `upload/versions/${encodeURIComponent(id)}/pages`,
            upload.image,
            10 * 1024 * 1024,
          );
          if (!result || epoch !== identity || current !== view) return;
          publish({
            ...state,
            uploads: state.uploads.map((item, offset) =>
              offset === index
                ? {
                    ...item,
                    status: "uploaded",
                    error: null,
                    pageUrl: result.pageUrl,
                  }
                : item,
            ),
          });
        } catch (error) {
          if (epoch !== identity || current !== view) return;
          const definitive =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408;
          publish({
            ...state,
            uploads: state.uploads.map((item, offset) =>
              offset === index
                ? {
                    ...item,
                    status: definitive ? "error" : "uncertain",
                    error:
                      error instanceof Error
                        ? error.message
                        : "อัปโหลดไม่สำเร็จ",
                  }
                : item,
            ),
          });
          break;
        }
      }
      if (epoch === identity && current === view)
        await refreshVersion(id, epoch, current);
    })()
      .catch((error) => {
        if (epoch === identity && current === view)
          publish({
            ...state,
            error:
              error instanceof Error ? error.message : "ตรวจ pages ไม่สำเร็จ",
          });
      })
      .finally(() => {
        if (processing === promise) processing = null;
        if (epoch === identity && current === view)
          publish({ ...state, uploading: false });
      });
    processing = promise;
    return promise;
  }
  const store = {
    snapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async load() {
      const current = ++loadGeneration,
        epoch = identity;
      publish({ ...state, loading: true, error: null });
      try {
        const response = await request("versions/me/versions");
        if (!response) return;
        const versions = (await response.json()) as ChapterVersion[];
        if (current === loadGeneration && epoch === identity)
          publish({ ...state, versions, loading: false });
      } catch (error) {
        if (current === loadGeneration && epoch === identity)
          publish({
            ...state,
            loading: false,
            error:
              error instanceof Error ? error.message : "โหลด Studio ไม่สำเร็จ",
          });
      }
    },
    async becomeCreator(
      body: { bio?: string; translatorLanguages?: string[] } = {},
    ) {
      const epoch = identity,
        uid = options.session.snapshot().account?.uid;
      if (Number(options.session.snapshot().account?.role) !== 0)
        throw new Error("บัญชีนี้ไม่ต้องสมัครนักแปลใหม่");
      const response = await request(
        "users/me/become-translator",
        { method: "POST", body: JSON.stringify(body) },
        false,
      );
      if (!response || epoch !== identity) return false;
      await options.session.refreshAccount();
      if (options.session.snapshot().account?.uid !== uid) return false;
      await store.load();
      return [1, 2, 8].includes(
        Number(options.session.snapshot().account?.role),
      );
    },
    async loadEarnings() {
      const epoch = identity,
        current = ++earningsGeneration;
      publish({ ...state, earningsLoading: true, earningsError: null });
      try {
        const response = await request("wallet/earnings");
        if (!response) return;
        const earnings = (await response.json()) as CreatorEarnings;
        if (epoch === identity && current === earningsGeneration)
          publish({ ...state, earnings, earningsLoading: false });
      } catch (error) {
        if (epoch === identity && current === earningsGeneration)
          publish({
            ...state,
            earningsLoading: false,
            earningsError:
              error instanceof Error ? error.message : "โหลดรายได้ไม่สำเร็จ",
          });
      }
    },
    beginNew() {
      if (processing || creation || queueing)
        throw new Error("รอรายการปัจจุบันก่อน");
      view++;
      creation = null;
      publish({
        ...state,
        version: null,
        creationUncertain: false,
        error: null,
        uploads: [],
        uploading: false,
      });
    },
    async open(id: string) {
      if (processing || creation || queueing)
        throw new Error("รอรายการปัจจุบันก่อน");
      const current = ++view,
        epoch = identity;
      publish({
        ...state,
        version: null,
        loading: true,
        error: null,
        creationUncertain: false,
        uploads: [],
      });
      try {
        const response = await request(`versions/${encodeURIComponent(id)}`);
        if (!response) return;
        const version = (await response.json()) as ChapterVersion;
        if (epoch !== identity || current !== view) return;
        if (version.translatorUid !== options.session.snapshot().account?.uid)
          throw new Error("แก้ไขได้เฉพาะผลงานของคุณ");
        publish({ ...state, version, loading: false });
      } catch (error) {
        if (epoch === identity && current === view)
          publish({
            ...state,
            loading: false,
            error:
              error instanceof Error ? error.message : "โหลดเวอร์ชันไม่สำเร็จ",
          });
      }
    },
    ensureDraft(body: VersionDraft): Promise<ChapterVersion | null> {
      if (state.version) return Promise.resolve(state.version);
      if (creation) return creation;
      if (state.creationUncertain)
        return Promise.reject(
          new Error("ยังไม่ทราบผลสร้าง draft กรุณาตรวจผลงานเดิมก่อนสร้างซ้ำ"),
        );
      const epoch = identity,
        current = view;
      const promise = (async () => {
        if (
          !body.titleId ||
          !body.titleName.trim() ||
          !body.chapterNumber.trim() ||
          !body.language ||
          (body.description?.length ?? 0) > 1000 ||
          !Number.isInteger(body.priceCoins ?? 0) ||
          (body.priceCoins ?? 0) < 0
        )
          throw new Error("ตรวจสอบมังงะ ตอน ภาษา หมายเหตุ และราคาเหรียญ");
        try {
          const response = await request("versions", {
            method: "POST",
            body: JSON.stringify(body),
          });
          if (!response) return null;
          const version = (await response.json()) as ChapterVersion;
          if (epoch !== identity || current !== view) return null;
          if (version.translatorUid !== options.session.snapshot().account?.uid)
            throw new Error("ข้อมูลผู้สร้างไม่ตรงกับบัญชี");
          loadGeneration++;
          publish({
            ...state,
            version,
            versions: [
              version,
              ...state.versions.filter(
                (item) => item.versionId !== version.versionId,
              ),
            ],
          });
          return version;
        } catch (error) {
          if (epoch === identity && current === view)
            publish({
              ...state,
              creationUncertain: !(
                error instanceof ApiError &&
                error.status >= 400 &&
                error.status < 500 &&
                error.status !== 408
              ),
            });
          throw error;
        }
      })().finally(() => {
        if (creation === promise) creation = null;
      });
      creation = promise;
      return promise;
    },
    async saveMetadata(body: VersionMetadata) {
      const epoch = identity,
        current = view,
        version = selectedVersion();
      if (!["draft", "published"].includes(version.status))
        throw new Error("สถานะนี้ยังแก้ metadata ไม่ได้");
      if (
        body.priceCoins !== undefined &&
        (!Number.isInteger(body.priceCoins) || body.priceCoins < 0)
      )
        throw new Error("ราคาเหรียญต้องเป็นจำนวนเต็มตั้งแต่ศูนย์");
      if ((body.description?.length ?? 0) > 1000)
        throw new Error("หมายเหตุไม่เกิน 1000 ตัวอักษร");
      const response = await request(
        `versions/${encodeURIComponent(version.versionId)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (!response || epoch !== identity || current !== view) return false;
      await refreshVersion(version.versionId, epoch, current);
      return !state.error;
    },
    reorderPages(pages: string[]) {
      const version = selectedVersion(),
        known = new Set(version.pages);
      if (
        pages.length !== version.pages.length ||
        new Set(pages).size !== known.size ||
        pages.some((page) => !known.has(page))
      )
        return Promise.reject(new Error("ลำดับต้องมี pages เดิมครบทุกหน้า"));
      return pageMutation({ pages }, "PUT");
    },
    deletePage(pageUrl: string) {
      const version = selectedVersion();
      if (!version.pages.includes(pageUrl))
        return Promise.reject(new Error("ไม่พบ page นี้"));
      return pageMutation({ pageUrl }, "DELETE");
    },
    async status(status: ChapterVersion["status"]) {
      const version = selectedVersion(),
        epoch = identity,
        current = view;
      const allowed: Partial<
        Record<ChapterVersion["status"], ChapterVersion["status"][]>
      > = {
        draft: ["published", "pending_moderation"],
        published: ["draft"],
        rejected: ["draft"],
      };
      if (!allowed[version.status]?.includes(status))
        throw new Error("เปลี่ยนสถานะนี้ไม่ได้");
      if (
        ["published", "pending_moderation"].includes(status) &&
        !version.pages.length
      )
        throw new Error("เพิ่ม pages ก่อนเผยแพร่หรือส่งตรวจ");
      const response = await request(
        `versions/${encodeURIComponent(version.versionId)}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      if (!response || epoch !== identity || current !== view) return false;
      await refreshVersion(version.versionId, epoch, current);
      return true;
    },
    async deleteVersion() {
      const version = selectedVersion(),
        epoch = identity,
        current = view;
      const response = await request(
        `versions/${encodeURIComponent(version.versionId)}`,
        { method: "DELETE" },
      );
      if (!response || epoch !== identity || current !== view) return false;
      view++;
      loadGeneration++;
      publish({
        ...state,
        version: null,
        versions: state.versions.filter(
          (item) => item.versionId !== version.versionId,
        ),
        uploads: [],
        error: null,
      });
      return true;
    },
    queuePages(images: PickedImage[], draft?: VersionDraft): Promise<void> {
      if (!unsubscribe) return Promise.resolve();
      media.activate();
      if (queueing) return queueing;
      const promise = (async () => {
        if (processing) return processing;
        const epoch = identity,
          current = view;
        images.forEach((image) => validateImage(image, 10 * 1024 * 1024));
        if (!state.version) {
          if (!draft) throw new Error("ระบุข้อมูล draft ก่อน");
          if (!(await store.ensureDraft(draft))) return;
        }
        if (epoch !== identity || current !== view) return;
        if (!["draft", "published"].includes(state.version!.status))
          throw new Error("สถานะนี้ยังอัปโหลด pages ไม่ได้");
        publish({
          ...state,
          uploads: [
            ...state.uploads,
            ...images.map((image) => ({
              image,
              status: "pending" as const,
              error: null,
            })),
          ],
        });
        return uploadPending();
      })().finally(() => {
        if (queueing === promise) queueing = null;
      });
      queueing = promise;
      return promise;
    },
    retryPages(acknowledgeUncertain = false) {
      if (processing) return processing;
      if (
        state.uploads.some((upload) => upload.status === "uncertain") &&
        !acknowledgeUncertain
      )
        return Promise.reject(
          new Error(
            "ผลอัปโหลดไม่ชัดเจน กรุณาตรวจ pages ที่ server ก่อนยืนยันส่งซ้ำ",
          ),
        );
      publish({
        ...state,
        uploads: state.uploads.map((upload) =>
          upload.status === "error" || upload.status === "uncertain"
            ? { ...upload, status: "pending", error: null }
            : upload,
        ),
      });
      return uploadPending();
    },
    activate() {
      media.activate();
      identityChanged();
      unsubscribe ??= options.session.subscribe(identityChanged);
    },
    dispose() {
      media.dispose();
      identity++;
      view++;
      creation = null;
      processing = null;
      queueing = null;
      loadGeneration++;
      earningsGeneration++;
      requests.forEach((request) => request.abort());
      unsubscribe?.();
      unsubscribe = undefined;
      publish({
        ...state,
        version: null,
        versions: [],
        uploads: [],
        uploading: false,
        earnings: null,
      });
    },
  };
  return store;
}
