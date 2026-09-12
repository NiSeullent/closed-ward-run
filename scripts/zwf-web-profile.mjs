import { crc32 } from 'node:zlib';

export const CHUNK_FLAGS = Object.freeze({ SKIPPABLE: 1, HAS_CRC: 2 });
export const PROFILE_CHUNK = 'WEBZ';

const align4 = (value) => (value + 3) & ~3;

function chunk(id, payload, flags = 0) {
  if (!/^[\x20-\x7e]{4}$/.test(id)) throw new Error(`invalid FourCC: ${id}`);
  const crcLength = flags & CHUNK_FLAGS.HAS_CRC ? 4 : 0;
  const length = align4(16 + payload.length + crcLength);
  const out = Buffer.alloc(length);
  out.write(id, 0, 4, 'ascii');
  out[4] = 0;
  out[5] = flags;
  out.writeUInt32LE(payload.length, 8);
  out.writeUInt32LE(payload.length, 12);
  payload.copy(out, 16);
  if (crcLength) out.writeUInt32LE(crc32(payload), 16 + payload.length);
  return out;
}

function stage({ width, height, fps, background = 0x050508ff }) {
  const out = Buffer.alloc(24);
  out.writeUInt32LE(width, 0);
  out.writeUInt32LE(height, 4);
  out.writeFloatLE(fps, 8);
  out.writeUInt32LE(background >>> 0, 12);
  return out;
}

export function createWebZwf({ zip, title, width = 1280, height = 720, fps = 60 }) {
  const metadata = Buffer.from(JSON.stringify({
    title,
    tool: 'closed-ward-run/zwf-web-profile',
    profile: 'html5-sandbox/1',
    entryPoint: 'index.html',
    runtimeMin: '0.1.0',
  }));
  const parts = [
    chunk('META', metadata),
    chunk('STAG', stage({ width, height, fps })),
    chunk('CHRS', Buffer.alloc(4)),
    chunk('MCLP', Buffer.alloc(0)),
    chunk(PROFILE_CHUNK, Buffer.from(zip), CHUNK_FLAGS.SKIPPABLE | CHUNK_FLAGS.HAS_CRC),
  ];
  const size = 32 + parts.reduce((sum, part) => sum + part.length, 0);
  const header = Buffer.alloc(32);
  header.write('ZWF1', 0, 4, 'ascii');
  header[4] = 0;
  header[5] = 1;
  header.writeUInt16LE(2, 6);
  header.writeUInt32LE(32, 8);
  header.writeUInt32LE(parts.length, 12);
  header.writeBigUInt64LE(BigInt(size), 16);
  header.writeUInt32LE(crc32(header.subarray(0, 28)), 28);
  return Buffer.concat([header, ...parts]);
}

export function inspectWebZwf(bytes) {
  const data = Buffer.from(bytes);
  if (data.length < 32 || data.toString('ascii', 0, 4) !== 'ZWF1') throw new Error('not a ZWF1 file');
  if (data.readUInt32LE(28) !== crc32(data.subarray(0, 28))) throw new Error('invalid ZWF header CRC');
  if (Number(data.readBigUInt64LE(16)) !== data.length) throw new Error('ZWF file size mismatch');
  const declared = data.readUInt32LE(12);
  const chunks = [];
  let offset = data.readUInt32LE(8);
  for (let index = 0; index < declared; index += 1) {
    if (offset + 16 > data.length) throw new Error('truncated ZWF chunk header');
    const id = data.toString('ascii', offset, offset + 4);
    const flags = data[offset + 5];
    const size = data.readUInt32LE(offset + 8);
    const payloadStart = offset + 16;
    const payloadEnd = payloadStart + size;
    if (payloadEnd > data.length) throw new Error(`truncated ${id} chunk`);
    const payload = data.subarray(payloadStart, payloadEnd);
    let end = payloadEnd;
    if (flags & CHUNK_FLAGS.HAS_CRC) {
      if (end + 4 > data.length || data.readUInt32LE(end) !== crc32(payload)) throw new Error(`invalid ${id} CRC`);
      end += 4;
    }
    chunks.push({ id, flags, payload });
    offset = align4(end);
  }
  if (offset !== data.length) throw new Error('trailing ZWF bytes');
  for (const required of ['META', 'STAG', 'CHRS', 'MCLP', PROFILE_CHUNK]) {
    if (!chunks.some((entry) => entry.id === required)) throw new Error(`missing ${required} chunk`);
  }
  return chunks;
}
