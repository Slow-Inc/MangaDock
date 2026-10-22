type StatusMessageProps = {
  kind: "status" | "alert";
  message: string | null | undefined;
  className: string;
};

/**
 * A live region that stays mounted before it has anything to say.
 *
 * Screen readers announce a region inserted together with its text
 * unreliably (WCAG 4.1.3), so the element must exist first and only its
 * contents change later. The visual classes are applied only while there
 * is a message, so an empty region takes no space.
 */
export default function StatusMessage({ kind, message, className }: StatusMessageProps) {
  return (
    <p
      role={kind}
      aria-live={kind === "alert" ? "assertive" : "polite"}
      className={message ? className : undefined}
    >
      {message}
    </p>
  );
}
