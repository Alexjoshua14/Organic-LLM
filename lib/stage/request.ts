import "server-only";

const MAX_STAGE_REQUEST_BYTES = 128 * 1024;

export class StagePayloadError extends Error {}

export async function readStagePayload(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_STAGE_REQUEST_BYTES) throw new StagePayloadError("Request is too large");
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_STAGE_REQUEST_BYTES) {
        await reader.cancel();
        throw new StagePayloadError("Request is too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof StagePayloadError) throw error;
    return null;
  } finally {
    reader.releaseLock();
  }
}
