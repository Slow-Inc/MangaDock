export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    const json = JSON.stringify(e);
    return json !== undefined ? json : String(e);
  } catch {
    return String(e);
  }
}
