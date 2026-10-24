/**
 * "n / max" under a text field once it nears its limit (#988). The field's own `maxLength` stops typing at the limit;
 * this says why the text stopped. The field points at it with `aria-describedby={id}`, and reaching the limit is
 * announced once through an always-mounted status region (a region inserted with its text is not announced reliably).
 * Hidden below 90 % so short posts carry no noise.
 */
export default function LimitCounter({ id, value, max }: { id: string; value: string; max: number }) {
  const full = value.length >= max;
  return (
    <>
      <p
        id={id}
        className={`mt-1 text-right text-xs tabular-nums empty:hidden ${full ? "text-danger" : "text-ink-2"}`}
      >
        {value.length >= max * 0.9 ? `${value.length.toLocaleString()} / ${max.toLocaleString()}` : null}
      </p>
      <span role="status" className="sr-only">
        {full ? `ถึงจำนวนตัวอักษรสูงสุด ${max.toLocaleString()} ตัวแล้ว` : ""}
      </span>
    </>
  );
}
