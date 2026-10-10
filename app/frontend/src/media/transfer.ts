import type { Attachment, ExportMedia } from '../domain/logs/types';
import type { StoredMedia } from './types';
import { readBlob, sha256 } from './files';
import { encodedByteLength } from '../domain/transfer/encoding';
export { MAX_EXPORT_BYTES } from '../domain/transfer/encoding';
export async function encodeMedia(media: StoredMedia): Promise<ExportMedia> {
  const bytes = new Uint8Array(await readBlob(media.blob));
  if ((await sha256(bytes.buffer)) !== media.id)
    throw new Error('Stored media checksum does not match.');
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return { id: media.id, dataBase64: btoa(chunks.join('')) };
}
/** Verify all bytes before opening a write transaction; no partial imports. */
export async function decodeMedia(
  media: ExportMedia[],
  attachments: Attachment[],
): Promise<StoredMedia[]> {
  const byHash = new Map(
    attachments.map((attachment) => [attachment.sha256, attachment]),
  );
  const decoded: StoredMedia[] = [];
  for (const file of media) {
    const metadata = byHash.get(file.id);
    if (!metadata || encodedByteLength(file.dataBase64) !== metadata.size)
      throw new Error('Media size or reference does not match its attachment.');
    const binary = atob(file.dataBase64);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    if ((await sha256(bytes.buffer)) !== file.id)
      throw new Error('An attachment is damaged: its checksum does not match.');
    decoded.push({
      id: file.id,
      blob: new Blob([bytes], { type: metadata.mimeType }),
    });
  }
  return decoded;
}
