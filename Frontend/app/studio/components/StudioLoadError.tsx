import Mascot from "../../components/mascot/Mascot";

/** A failed Studio load (#828): says so and offers a retry, in place of zero metrics or an empty list. */
export default function StudioLoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
      <Mascot area="studio" state="sleeping" size={64} />
      <p className="text-sm font-medium text-ink">โหลด{what}ไม่สำเร็จ</p>
      <p className="text-xs text-ink-3">ลองโหลดใหม่อีกครั้ง</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 rounded-xl border border-line bg-fill px-4 py-2 text-sm font-medium text-ink smooth-hover-fast hover:border-ink-3 hover:bg-raised"
      >
        ลองใหม่
      </button>
    </div>
  );
}
