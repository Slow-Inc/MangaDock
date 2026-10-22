/** A non-2xx response, with its status — so a page can tell "not found" (404) from "could not load" (#913). */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

/** Only a confirmed 404 may be shown as "not found"; a network failure or a 5xx is a failed load, with a retry. */
export function isNotFound(err: unknown): boolean {
  return err instanceof HttpError && err.status === 404;
}
