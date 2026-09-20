export interface ImageType {
  mime: string;
  extension: string;
}

interface Signature extends ImageType {
  offset: number;
  bytes: number[];
  verify?: (buffer: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    offset: 0,
    bytes: [0xff, 0xd8, 0xff],
  },
  {
    mime: 'image/png',
    extension: 'png',
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    mime: 'image/gif',
    extension: 'gif',
    offset: 0,
    bytes: [0x47, 0x49, 0x46, 0x38],
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    verify: (buffer) => buffer.subarray(8, 12).toString('latin1') === 'WEBP',
  },
];

export const SUPPORTED_IMAGE_MIME_TYPES = SIGNATURES.map(
  (signature) => signature.mime,
);

function matches(buffer: Buffer, signature: Signature): boolean {
  const end = signature.offset + signature.bytes.length;

  if (buffer.length < end) {
    return false;
  }

  for (let index = 0; index < signature.bytes.length; index += 1) {
    if (buffer[signature.offset + index] !== signature.bytes[index]) {
      return false;
    }
  }

  return signature.verify ? signature.verify(buffer) : true;
}

export function detectImageType(buffer: Buffer): ImageType | null {
  const signature = SIGNATURES.find((candidate) => matches(buffer, candidate));

  return signature
    ? { mime: signature.mime, extension: signature.extension }
    : null;
}
