/**
 * "n / max" under a text field once it nears its limit (#988). The field's own `maxLength` stops typing at the limit;
 * this says why the text stopped. Hidden below 90 % so short posts carry no noise.
 */
export default function LimitCounter({ value, max }: { value: string; max: number }) {
  if (value.length < max * 0.9) return null;
  return (
    <p className={`mt-1 text-right text-xs tabular-nums ${value.length >= max ? "text-danger" : "text-ink-2"}`}>
      {value.length.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}
