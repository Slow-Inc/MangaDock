/**
 * How long a server render waits on the backend before falling back (#858). Without it a hung upstream holds the
 * page blank for as long as the backend does (measured: over 120 s on /book/[id]/reviews).
 */
export const SERVER_FETCH_TIMEOUT_MS = 8000;
