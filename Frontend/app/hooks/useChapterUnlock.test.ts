import { describe, it, expect, mock } from "bun:test";
import { performChapterUnlock, type PerformUnlockDeps } from "./useChapterUnlock";
import type { PurchaseResult } from "../lib/studioApi";

const VERSION_ID = "version-123";

function makeDeps(overrides: Partial<PerformUnlockDeps> = {}): {
  deps: PerformUnlockDeps;
  calls: {
    setPurchasingId: (string | null)[];
    onSuccess: PurchaseResult[];
    onInsufficient: number;
    onError: string[];
  };
} {
  const calls = {
    setPurchasingId: [] as (string | null)[],
    onSuccess: [] as PurchaseResult[],
    onInsufficient: 0,
    onError: [] as string[],
  };

  const deps: PerformUnlockDeps = {
    getIdToken: mock(async () => "token-abc"),
    purchaseUnlock: mock(async () => ({ unlocked: true }) as PurchaseResult),
    setPurchasingId: mock((id: string | null) => {
      calls.setPurchasingId.push(id);
    }),
    onSuccess: mock((result: PurchaseResult) => {
      calls.onSuccess.push(result);
    }),
    onInsufficient: mock(() => {
      calls.onInsufficient += 1;
    }),
    onError: mock((msg: string) => {
      calls.onError.push(msg);
    }),
    ...overrides,
  };

  return { deps, calls };
}

describe("performChapterUnlock", () => {
  it("sets purchasing to versionId before the await, then clears it in finally on success", async () => {
    const { deps, calls } = makeDeps();
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.setPurchasingId).toEqual([VERSION_ID, null]);
    expect(calls.onSuccess).toHaveLength(1);
  });

  it("token null -> purchaseUnlock NOT called, no callback fires, purchasing cleared", async () => {
    const purchaseUnlockMock = mock(async () => ({ unlocked: true }) as PurchaseResult);
    const { deps, calls } = makeDeps({
      getIdToken: mock(async () => null),
      purchaseUnlock: purchaseUnlockMock,
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(purchaseUnlockMock).not.toHaveBeenCalled();
    expect(calls.onSuccess).toHaveLength(0);
    expect(calls.onInsufficient).toBe(0);
    expect(calls.onError).toHaveLength(0);
    expect(calls.setPurchasingId).toEqual([VERSION_ID, null]);
  });

  it("result.unlocked:true -> onSuccess called once, onInsufficient/onError NOT called", async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => ({ unlocked: true } as PurchaseResult)),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onSuccess).toHaveLength(1);
    expect(calls.onSuccess[0]).toEqual({ unlocked: true });
    expect(calls.onInsufficient).toBe(0);
    expect(calls.onError).toHaveLength(0);
  });

  it("result.alreadyUnlocked:true (unlocked false) -> onSuccess called", async () => {
    const result: PurchaseResult = { unlocked: false, alreadyUnlocked: true };
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => result),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onSuccess).toHaveLength(1);
    expect(calls.onSuccess[0]).toEqual(result);
  });

  it("unlocked:false, alreadyUnlocked:false -> onSuccess NOT called, no error", async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => ({ unlocked: false, alreadyUnlocked: false }) as PurchaseResult),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onSuccess).toHaveLength(0);
    expect(calls.onInsufficient).toBe(0);
    expect(calls.onError).toHaveLength(0);
    expect(calls.setPurchasingId).toEqual([VERSION_ID, null]);
  });

  it('purchaseUnlock throws Error("Insufficient coins") -> onInsufficient called, onError NOT', async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => {
        throw new Error("Insufficient coins");
      }),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onInsufficient).toBe(1);
    expect(calls.onError).toHaveLength(0);
    expect(calls.onSuccess).toHaveLength(0);
  });

  it('throws Error("เหรียญไม่พอ") -> onInsufficient called', async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => {
        throw new Error("เหรียญไม่พอ");
      }),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onInsufficient).toBe(1);
    expect(calls.onError).toHaveLength(0);
  });

  it('throws Error("network boom") -> onError("network boom"), onInsufficient NOT', async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => {
        throw new Error("network boom");
      }),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onError).toEqual(["network boom"]);
    expect(calls.onInsufficient).toBe(0);
  });

  it("throws with empty message -> onError falls back to default message", async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => {
        throw new Error("");
      }),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.onError).toEqual(["ไม่สามารถปลดล็อคได้"]);
    expect(calls.onInsufficient).toBe(0);
  });

  it("setPurchasingId called with versionId then null (order preserved) on success", async () => {
    const { deps, calls } = makeDeps();
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.setPurchasingId).toEqual([VERSION_ID, null]);
  });

  it("setPurchasingId called with versionId then null (order preserved) on throw", async () => {
    const { deps, calls } = makeDeps({
      purchaseUnlock: mock(async () => {
        throw new Error("network boom");
      }),
    });
    await performChapterUnlock(deps, VERSION_ID);
    expect(calls.setPurchasingId).toEqual([VERSION_ID, null]);
  });
});
