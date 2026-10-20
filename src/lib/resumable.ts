// Google's resumable upload protocol (same for YouTube and Drive): the file goes up in 8 MB
// chunks, so a dropped connection only re-sends the current chunk.

const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB, as the protocol requires

export class RetryableError extends Error {}

export type ChunkResult = { status: number; body: string; range: string | null };

/**
 * Sends `file` to an upload session URL and returns the final response body (JSON text).
 * `onFatal` turns a non-retryable HTTP response into an Error.
 */
export async function sendResumable(
  location: string,
  token: string,
  file: Blob,
  type: string,
  onProgress: (fraction: number) => void,
  onFatal: (res: ChunkResult) => Error,
  signal?: AbortSignal,
): Promise<string> {
  let offset = 0;
  let failures = 0;
  while (true) {
    const end = Math.min(offset + CHUNK, file.size);
    try {
      const res = await putChunk(location, token, file, offset, end, type, signal, (sent) => onProgress((offset + sent) / file.size));
      if (res.status === 200 || res.status === 201) {
        onProgress(1);
        return res.body;
      }
      if (res.status === 308) {
        offset = nextOffset(res.range);
        failures = 0;
        continue;
      }
      if (res.status >= 500 || res.status === 0) throw new RetryableError(`server ${res.status}`);
      throw onFatal(res);
    } catch (e) {
      if (signal?.aborted) throw new Error("Upload cancelled.");
      if (!(e instanceof RetryableError) && !(e instanceof TypeError) && (e as Error).message !== "network") throw e;
      if (++failures > 6) throw new Error("Upload kept failing because of the network. Try again.");
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** failures)));
      // Ask the server how much it already has, then continue from there.
      const s = await putChunk(location, token, file, -1, -1, type, signal, () => {}).catch(() => null);
      if (s?.status === 200 || s?.status === 201) return s.body;
      if (s?.status === 308) offset = nextOffset(s.range);
    }
  }
}

function nextOffset(range: string | null) {
  // "bytes=0-12345" → 12346; no header means nothing was stored yet.
  const m = range?.match(/-(\d+)$/);
  return m ? Number(m[1]) + 1 : 0;
}

/** PUT one chunk with XHR (fetch has no upload progress). start = -1 sends a status query. */
function putChunk(
  url: string,
  token: string,
  file: Blob,
  start: number,
  end: number,
  type: string,
  signal: AbortSignal | undefined,
  onSent: (bytes: number) => void,
): Promise<ChunkResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (start < 0) {
      xhr.setRequestHeader("Content-Range", `bytes */${file.size}`);
    } else {
      xhr.setRequestHeader("Content-Type", type);
      xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
      xhr.upload.onprogress = (e) => onSent(e.loaded);
    }
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText, range: xhr.getResponseHeader("Range") });
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(start < 0 ? null : file.slice(start, end));
  });
}
