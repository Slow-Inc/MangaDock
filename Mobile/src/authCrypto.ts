type IntegerArray = Int8Array<ArrayBuffer> | Uint8Array<ArrayBuffer> | Uint8ClampedArray<ArrayBuffer> | Int16Array<ArrayBuffer> | Uint16Array<ArrayBuffer> | Int32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>;
export type AuthCryptoPort = { getRandomValues<T extends IntegerArray>(array: T): T; randomUUID(): string; digest(data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> };

// Supplies the WebCrypto operations used by Supabase PKCE on native platforms.
export function installAuthCrypto(port: AuthCryptoPort) {
  if (globalThis.crypto?.subtle) return;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues: port.getRandomValues,
      randomUUID: port.randomUUID,
      subtle: {
        digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
          const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
          if (name !== 'SHA-256') throw new Error('Unsupported native auth digest');
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          return port.digest(bytes);
        },
      },
    },
  });
}
