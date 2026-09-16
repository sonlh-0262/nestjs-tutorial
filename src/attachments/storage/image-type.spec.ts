import { detectImageType, SUPPORTED_IMAGE_MIME_TYPES } from './image-type';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

const withPayload = (header: number[]): Buffer =>
  Buffer.concat([Buffer.from(header), Buffer.alloc(32, 0x00)]);

const webp = (fourCC: string): Buffer =>
  Buffer.concat([
    Buffer.from([0x52, 0x49, 0x46, 0x46]),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from(fourCC, 'latin1'),
    Buffer.alloc(16, 0x00),
  ]);

describe('detectImageType', () => {
  it('recognises a PNG', () => {
    expect(detectImageType(withPayload(PNG_HEADER))).toEqual({
      mime: 'image/png',
      extension: 'png',
    });
  });

  it('recognises a JPEG', () => {
    expect(detectImageType(withPayload(JPEG_HEADER))).toEqual({
      mime: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('recognises a GIF', () => {
    expect(detectImageType(withPayload(GIF_HEADER))).toEqual({
      mime: 'image/gif',
      extension: 'gif',
    });
  });

  it('recognises a WebP', () => {
    expect(detectImageType(webp('WEBP'))).toEqual({
      mime: 'image/webp',
      extension: 'webp',
    });
  });

  it('rejects a RIFF container that is not WebP', () => {
    expect(detectImageType(webp('WAVE'))).toBeNull();
  });

  it('rejects an executable, whatever it claims to be', () => {
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);

    expect(detectImageType(elf)).toBeNull();
  });

  it('rejects SVG, which is markup rather than an image format', () => {
    expect(detectImageType(Buffer.from('<svg xmlns="..."></svg>'))).toBeNull();
  });

  it('rejects a buffer shorter than the signature it starts to match', () => {
    expect(detectImageType(Buffer.from(PNG_HEADER.slice(0, 4)))).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('exposes every supported media type', () => {
    expect(SUPPORTED_IMAGE_MIME_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
  });
});
