import handler from "vinext/server/fetch-handler";
import { sendDueAgreementReminders } from "./lib/agreement-reminders";
import { sendDueInquiryReminders } from "./lib/inquiry-reminders";

type AssetBinding = { fetch(request: Request): Promise<Response> };

function byteRange(value: string, size: number): { start: number; end: number } | null {
  // These short videos support one byte range per request, including suffixes.
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) ||
      (last !== null && !Number.isSafeInteger(last))) return null;
  const start = first ?? Math.max(0, size - (last ?? 0));
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
  return start < size && start <= end ? { start, end } : null;
}

async function heroVideoResponse(request: Request, assets: AssetBinding): Promise<Response> {
  const range = request.method === "GET" ? request.headers.get("Range") : null;
  const headers = new Headers(request.headers);
  headers.delete("Range");
  headers.delete("If-Range");
  headers.set("Accept-Encoding", "identity");
  // The assets binding fetches the deployed file directly, without routing back here.
  const asset = await assets.fetch(new Request(request, { headers }));
  if (asset.status !== 200) return asset;

  const responseHeaders = new Headers(asset.headers);
  responseHeaders.set("Accept-Ranges", "bytes");
  if (range === null) return new Response(asset.body, { status: 200, headers: responseHeaders });

  // A stale or weak If-Range validator must receive the complete current file.
  const ifRange = request.headers.get("If-Range");
  const etag = asset.headers.get("ETag");
  const modified = asset.headers.get("Last-Modified");
  if (ifRange && !(ifRange === etag && !ifRange.startsWith("W/")) &&
      !(modified && ifRange === modified)) {
    return new Response(asset.body, { status: 200, headers: responseHeaders });
  }

  // Only the two small hero MP4s use this path; ordinary downloads remain streamed.
  const file = await asset.blob();
  const interval = byteRange(range, file.size);
  if (!interval) {
    responseHeaders.set("Content-Range", `bytes */${file.size}`);
    responseHeaders.set("Content-Length", "0");
    return new Response(null, { status: 416, headers: responseHeaders });
  }

  const { start, end } = interval;
  responseHeaders.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
  responseHeaders.set("Content-Length", String(end - start + 1));
  // A fixed-length body also lets the Workers runtime calculate Content-Length.
  const body = await file.slice(start, end + 1).arrayBuffer();
  return new Response(body, { status: 206, headers: responseHeaders });
}

const worker = {
  ...handler,
  async fetch(request: Request, env: Cloudflare.Env & { ASSETS: AssetBinding }, ctx: ExecutionContext) {
    const path = new URL(request.url).pathname;
    if ((request.method === "GET" || request.method === "HEAD") &&
        (path === "/vietnam-hero.mp4" || path === "/vietnam-hero-mobile.mp4")) {
      return heroVideoResponse(request, env.ASSETS);
    }
    return handler.fetch(request, env, ctx);
  },
  async scheduled() {
    const jobs = [sendDueAgreementReminders(), sendDueInquiryReminders()];
    const results = await Promise.allSettled(jobs);
    for (const [index, result] of results.entries()) {
      const job = index === 0 ? "Agreement reminders" : "Inquiry reminders";
      if (result.status === "fulfilled") console.log(job, result.value);
      else console.error(`${job} failed; check configuration and service availability.`);
    }
  },
};

export default worker;
