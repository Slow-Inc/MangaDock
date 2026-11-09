/** "18+" on a title whose MangaDex rating is erotica or pornographic (#1102); nothing otherwise. */
import { isAdultRating } from "../../lib/contentLevel";

export default function AdultBadge({ rating, className = "" }: { rating?: string; className?: string }) {
  if (!isAdultRating(rating)) return null;
  return (
    <span
      aria-label="เนื้อหาสำหรับผู้ใหญ่ 18+"
      className={`inline-flex items-center rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-bg ${className}`}
    >
      18+
    </span>
  );
}
