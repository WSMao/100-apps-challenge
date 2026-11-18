/**
 * Type declarations for pako zlib compression library
 */

declare module 'pako' {
  export interface DeflateOptions {
    level?: number;
    windowBits?: number;
    memLevel?: number;
    strategy?: number;
    dictionary?: unknown;
    raw?: boolean;
    to?: 'string';
    gzip?: boolean;
  }

  export interface InflateOptions {
    windowBits?: number;
    dictionary?: unknown;
    raw?: boolean;
    to?: 'string';
  }

  export function deflate(input: string | Uint8Array | ArrayBuffer, options?: DeflateOptions): Uint8Array;
  export function deflate(input: string | Uint8Array | ArrayBuffer, options: DeflateOptions & { to: 'string' }): string;
  export function inflate(input: Uint8Array | ArrayBuffer | string, options?: InflateOptions): Uint8Array;
  export function inflate(input: Uint8Array | ArrayBuffer | string, options: InflateOptions & { to: 'string' }): string;
  export function gzip(input: string | Uint8Array | ArrayBuffer, options?: DeflateOptions): Uint8Array;
  export function ungzip(input: Uint8Array | ArrayBuffer | string, options?: InflateOptions): Uint8Array;

  const pako: {
    deflate: typeof deflate;
    inflate: typeof inflate;
    gzip: typeof gzip;
    ungzip: typeof ungzip;
  };

  export default pako;
}
