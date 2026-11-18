/**
 * Creative-Neuro Phase 1 All-in-One Web MVP
 * Zlib (Pako) Compression, PNG Chunk (tEXt / zTXt) Metadata & SVG Attribute Utilities
 *
 * Provides lossless project serialization and embedding into standalone PNG and SVG files
 * so exported visuals act as self-contained, re-editable project containers.
 * Isomorphic implementation: uses `pako` when bundled in browser/Vite and seamlessly
 * falls back to native zlib (`node:zlib`) in headless Node.js test environments.
 */

export const NEURO_PNG_KEYWORD = 'CreativeNeuro';
export const NEURO_SVG_ATTRIBUTE = 'data-neuro-payload';

// Standard 8-byte PNG file signature: 137 80 78 71 13 10 26 10
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

// Minimum valid 1x1 transparent PNG (67 bytes) used as fallback when no canvas DOM is mounted
export const FALLBACK_1X1_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Optional dynamically loaded pako instance for browser/Vite environments
interface PakoLike {
  deflate: (data: string | Uint8Array) => Uint8Array;
  inflate: (data: Uint8Array, options?: { to?: 'string' }) => Uint8Array | string;
}

interface NodeZlibLike {
  deflateSync: (buf: Uint8Array | Buffer) => Buffer;
  inflateSync: (buf: Uint8Array | Buffer) => Buffer;
}

let pakoInstance: PakoLike | null = null;

// Attempt non-blocking dynamic import of pako when running in bundler/browser environment
const pakoSpecifier = 'pako';
void import(/* @vite-ignore */ pakoSpecifier)
  .then((mod: unknown) => {
    const resolved =
      mod && typeof mod === 'object' && 'default' in mod
        ? (mod as { default: PakoLike }).default
        : (mod as PakoLike);
    if (resolved && typeof resolved.deflate === 'function') {
      pakoInstance = resolved;
    }
  })
  .catch(() => {
    // Running in headless Node environment without node_modules; native zlib fallback will be used
  });

function getNodeZlib(): NodeZlibLike | null {
  if (
    typeof process !== 'undefined' &&
    typeof (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule ===
      'function'
  ) {
    return (
      process as unknown as { getBuiltinModule: (id: string) => NodeZlibLike }
    ).getBuiltinModule('zlib');
  }
  return null;
}

// ============================================================================
// 1. Base64 <-> Uint8Array Conversion
// ============================================================================

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const subarray = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...subarray);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(cleaned, 'base64'));
  }
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// 2. Zlib Deflate / Inflate (Pako + RFC 1950 Native Fallback)
// ============================================================================

function computeAdler32(data: Uint8Array): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Pure RFC 1950 uncompressed stored-block deflate fallback if neither pako nor node:zlib is loaded yet.
 */
function fallbackStoredDeflate(raw: Uint8Array): Uint8Array {
  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const out = new Uint8Array(2 + numBlocks * 5 + raw.length + 4);
  // Zlib header: CMF = 0x78 (deflate, 32K window), FLG = 0x01 (no dict, check bits)
  out[0] = 0x78;
  out[1] = 0x01;

  let readPos = 0;
  let writePos = 2;
  for (let b = 0; b < numBlocks; b++) {
    const isFinal = b === numBlocks - 1 ? 1 : 0;
    const len = Math.min(maxBlock, raw.length - readPos);
    const nlen = ~len & 0xffff;
    out[writePos++] = isFinal; // BFINAL=isFinal, BTYPE=00 (stored)
    out[writePos++] = len & 0xff;
    out[writePos++] = (len >>> 8) & 0xff;
    out[writePos++] = nlen & 0xff;
    out[writePos++] = (nlen >>> 8) & 0xff;
    out.set(raw.subarray(readPos, readPos + len), writePos);
    writePos += len;
    readPos += len;
  }

  const adler = computeAdler32(raw);
  writeUint32BE(out, writePos, adler);
  return out;
}

function fallbackStoredInflate(compressed: Uint8Array): Uint8Array {
  if (compressed.length < 6) {
    throw new Error('Invalid zlib stream');
  }
  const chunks: Uint8Array[] = [];
  let pos = 2;
  while (pos < compressed.length - 4) {
    const header = compressed[pos++];
    const isFinal = (header & 1) === 1;
    const btype = (header >>> 1) & 3;
    if (btype !== 0) {
      throw new Error('Compressed stream requires pako or node:zlib');
    }
    const len = compressed[pos] | (compressed[pos + 1] << 8);
    pos += 4; // skip len + nlen
    chunks.push(compressed.subarray(pos, pos + len));
    pos += len;
    if (isFinal) break;
  }
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Compresses a UTF-8 string into raw zlib-deflated bytes using pako (or native zlib).
 */
export function deflateToBytes(input: string): Uint8Array {
  if (pakoInstance) {
    return new Uint8Array(pakoInstance.deflate(input));
  }
  const nodeZlib = getNodeZlib();
  const utf8Bytes = new TextEncoder().encode(input);
  if (nodeZlib) {
    return new Uint8Array(nodeZlib.deflateSync(utf8Bytes));
  }
  return fallbackStoredDeflate(utf8Bytes);
}

/**
 * Decompresses zlib-deflated bytes back into a UTF-8 string using pako (or native zlib).
 */
export function inflateFromBytes(compressed: Uint8Array): string {
  if (pakoInstance) {
    const res = pakoInstance.inflate(compressed, { to: 'string' });
    return typeof res === 'string' ? res : new TextDecoder('utf-8').decode(res);
  }
  const nodeZlib = getNodeZlib();
  if (nodeZlib) {
    const buf = nodeZlib.inflateSync(compressed);
    return new TextDecoder('utf-8').decode(buf);
  }
  return new TextDecoder('utf-8').decode(fallbackStoredInflate(compressed));
}

/**
 * Compresses a JSON string with pako deflate and encodes it as a base64 string.
 */
export function compressPayload(jsonString: string): string {
  const deflated = deflateToBytes(jsonString);
  return uint8ArrayToBase64(deflated);
}

/**
 * Decompresses a base64-encoded pako payload or raw Uint8Array back into a JSON string.
 */
export function decompressPayload(payload: string | Uint8Array): string {
  if (payload instanceof Uint8Array) {
    return inflateFromBytes(payload);
  }

  const trimmed = payload.trim();
  const metadataIdx = trimmed.indexOf('#metadata=');
  const normalizedBase64 =
    metadataIdx !== -1 ? trimmed.slice(metadataIdx + '#metadata='.length) : trimmed;

  const compressedBytes = base64ToUint8Array(normalizedBase64);
  return inflateFromBytes(compressedBytes);
}

// ============================================================================
// 3. IEEE 802.3 CRC32 Calculation for PNG Chunks
// ============================================================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function readUint32BE(source: Uint8Array, offset: number): number {
  return (
    ((source[offset] << 24) |
      (source[offset + 1] << 16) |
      (source[offset + 2] << 8) |
      source[offset + 3]) >>>
    0
  );
}

function encodeAscii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function decodeAscii(bytes: Uint8Array): string {
  let str = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    str += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return str;
}

// ============================================================================
// 4. PNG tEXt & zTXt Chunk Embedding & Extraction
// ============================================================================

/**
 * Builds a PNG `tEXt` chunk: [length (4B)] ['tEXt' (4B)] [keyword \0 text] [crc (4B)]
 */
export function createPngTextChunk(keyword: string, text: string): Uint8Array {
  const keyBytes = encodeAscii(keyword);
  const textBytes = encodeAscii(text);
  const dataLength = keyBytes.length + 1 + textBytes.length;

  const chunk = new Uint8Array(4 + 4 + dataLength + 4);
  writeUint32BE(chunk, 0, dataLength);

  // Chunk type: 'tEXt'
  chunk[4] = 0x74; // 't'
  chunk[5] = 0x45; // 'E'
  chunk[6] = 0x58; // 'X'
  chunk[7] = 0x74; // 't'

  chunk.set(keyBytes, 8);
  chunk[8 + keyBytes.length] = 0; // Null separator
  chunk.set(textBytes, 8 + keyBytes.length + 1);

  const crcInput = chunk.subarray(4, 8 + dataLength);
  const crcVal = crc32(crcInput);
  writeUint32BE(chunk, 8 + dataLength, crcVal);

  return chunk;
}

/**
 * Builds a PNG `zTXt` chunk: [length (4B)] ['zTXt' (4B)] [keyword \0 compression_method(0) compressed_data] [crc (4B)]
 */
export function createPngZtxtChunk(keyword: string, text: string): Uint8Array {
  const keyBytes = encodeAscii(keyword);
  const compressedData = deflateToBytes(text);
  const dataLength = keyBytes.length + 2 + compressedData.length;

  const chunk = new Uint8Array(4 + 4 + dataLength + 4);
  writeUint32BE(chunk, 0, dataLength);

  // Chunk type: 'zTXt'
  chunk[4] = 0x7a; // 'z'
  chunk[5] = 0x54; // 'T'
  chunk[6] = 0x58; // 'X'
  chunk[7] = 0x74; // 't'

  chunk.set(keyBytes, 8);
  chunk[8 + keyBytes.length] = 0; // Null separator
  chunk[8 + keyBytes.length + 1] = 0; // Compression method 0 (zlib deflate)
  chunk.set(compressedData, 8 + keyBytes.length + 2);

  const crcInput = chunk.subarray(4, 8 + dataLength);
  const crcVal = crc32(crcInput);
  writeUint32BE(chunk, 8 + dataLength, crcVal);

  return chunk;
}

export function isValidPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

/**
 * Embeds a `tEXt` metadata chunk right before the `IEND` chunk of a PNG binary.
 */
export function embedPngTextChunk(
  pngBytes: Uint8Array,
  text: string,
  keyword: string = NEURO_PNG_KEYWORD
): Uint8Array {
  if (!isValidPng(pngBytes)) {
    throw new Error('Invalid PNG binary signature');
  }

  const textChunk = createPngTextChunk(keyword, text);
  const chunksBeforeIend: Uint8Array[] = [pngBytes.subarray(0, 8)];
  let iendChunk: Uint8Array | null = null;

  let offset = 8;
  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const totalChunkLen = 4 + 4 + length + 4;
    if (offset + totalChunkLen > pngBytes.length) {
      break;
    }

    const type = decodeAscii(pngBytes.subarray(offset + 4, offset + 8));
    const currentChunk = pngBytes.subarray(offset, offset + totalChunkLen);

    if (type === 'IEND') {
      iendChunk = currentChunk;
      break;
    }

    // Skip any older tEXt/zTXt chunk with the same keyword so we replace cleanly
    if (type === 'tEXt' || type === 'zTXt') {
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      let nullIdx = dataStart;
      while (nullIdx < dataEnd && pngBytes[nullIdx] !== 0) {
        nullIdx++;
      }
      const existingKeyword = decodeAscii(pngBytes.subarray(dataStart, nullIdx));
      if (existingKeyword === keyword) {
        offset += totalChunkLen;
        continue;
      }
    }

    chunksBeforeIend.push(currentChunk);
    offset += totalChunkLen;
  }

  if (!iendChunk) {
    // Construct standard 12-byte IEND chunk if missing
    iendChunk = new Uint8Array([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  }

  const totalSize =
    chunksBeforeIend.reduce((acc, c) => acc + c.length, 0) +
    textChunk.length +
    iendChunk.length;

  const output = new Uint8Array(totalSize);
  let writePos = 0;
  for (const part of chunksBeforeIend) {
    output.set(part, writePos);
    writePos += part.length;
  }
  output.set(textChunk, writePos);
  writePos += textChunk.length;
  output.set(iendChunk, writePos);

  return output;
}

/**
 * Scans a PNG binary for a `tEXt` or `zTXt` chunk matching `keyword` (or default CreativeNeuro keywords)
 * and returns the stored string payload.
 */
export function extractPngTextChunk(
  pngBytes: Uint8Array,
  keyword: string = NEURO_PNG_KEYWORD
): string | null {
  if (!isValidPng(pngBytes)) {
    return null;
  }

  const acceptedKeywords = new Set([keyword, NEURO_PNG_KEYWORD, 'neuro-payload']);
  let offset = 8;

  while (offset + 8 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, offset);
    const totalChunkLen = 4 + 4 + length + 4;
    if (offset + totalChunkLen > pngBytes.length) {
      break;
    }

    const type = decodeAscii(pngBytes.subarray(offset + 4, offset + 8));
    if (type === 'tEXt' || type === 'zTXt') {
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      let nullIdx = dataStart;
      while (nullIdx < dataEnd && pngBytes[nullIdx] !== 0) {
        nullIdx++;
      }

      if (nullIdx < dataEnd) {
        const chunkKeyword = decodeAscii(pngBytes.subarray(dataStart, nullIdx));
        if (acceptedKeywords.has(chunkKeyword)) {
          if (type === 'tEXt') {
            return decodeAscii(pngBytes.subarray(nullIdx + 1, dataEnd));
          } else {
            // zTXt has 1 byte compression method right after null separator
            const compressedBytes = pngBytes.subarray(nullIdx + 2, dataEnd);
            return inflateFromBytes(compressedBytes);
          }
        }
      }
    }

    if (type === 'IEND') {
      break;
    }

    offset += totalChunkLen;
  }

  return null;
}

/**
 * Embeds a compressed base64 payload into a PNG Data URL (`data:image/png;base64,...`).
 */
export function embedPayloadInPngDataUrl(
  pngDataUrl: string,
  base64Payload: string,
  keyword: string = NEURO_PNG_KEYWORD
): string {
  const hashIdx = pngDataUrl.indexOf('#');
  const cleanUrl = hashIdx !== -1 ? pngDataUrl.slice(0, hashIdx) : pngDataUrl;
  const pngBytes = base64ToUint8Array(cleanUrl);
  const embeddedBytes = embedPngTextChunk(pngBytes, base64Payload, keyword);
  const newBase64 = uint8ArrayToBase64(embeddedBytes);
  return `data:image/png;base64,${newBase64}`;
}

/**
 * Extracts a compressed base64 payload from a PNG Data URL or `#metadata=` fragment.
 */
export function extractPayloadFromPngDataUrl(
  pngDataUrl: string,
  keyword: string = NEURO_PNG_KEYWORD
): string | null {
  const metadataMarker = '#metadata=';
  const hashIdx = pngDataUrl.indexOf(metadataMarker);
  const cleanUrl = hashIdx !== -1 ? pngDataUrl.slice(0, hashIdx) : pngDataUrl;

  try {
    const pngBytes = base64ToUint8Array(cleanUrl);
    if (isValidPng(pngBytes)) {
      const chunkPayload = extractPngTextChunk(pngBytes, keyword);
      if (chunkPayload) {
        return chunkPayload;
      }
    }
  } catch {
    // Fall through to hash fragment check
  }

  if (hashIdx !== -1) {
    return pngDataUrl.slice(hashIdx + metadataMarker.length).trim();
  }

  return null;
}

// ============================================================================
// 5. SVG `data-neuro-payload` Attribute Embedding & Extraction
// ============================================================================

/**
 * Injects `data-neuro-payload="<base64Payload>"` into the root `<svg>` element.
 */
export function embedPayloadInSvg(svgString: string, base64Payload: string): string {
  const escapedPayload = base64Payload.replace(/"/g, '&quot;');
  const attrRegex = new RegExp(`\\s${NEURO_SVG_ATTRIBUTE}="[^"]*"`, 'i');

  if (attrRegex.test(svgString)) {
    return svgString.replace(
      attrRegex,
      ` ${NEURO_SVG_ATTRIBUTE}="${escapedPayload}"`
    );
  }

  return svgString.replace(
    /<svg\b([^>]*)>/i,
    `<svg$1 ${NEURO_SVG_ATTRIBUTE}="${escapedPayload}">`
  );
}

/**
 * Extracts the `data-neuro-payload` attribute value from an SVG document string.
 */
export function extractPayloadFromSvg(svgString: string): string | null {
  const match = svgString.match(
    new RegExp(`${NEURO_SVG_ATTRIBUTE}=["']([^"']+)["']`, 'i')
  );
  if (!match || !match[1]) {
    return null;
  }
  return match[1].replace(/&quot;/g, '"').trim();
}
