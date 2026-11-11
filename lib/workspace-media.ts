import { env } from "cloudflare:workers";

export const workspaceMediaSchema = `CREATE TABLE IF NOT EXISTS owner_workspace_photos (
  id text PRIMARY KEY NOT NULL, title text NOT NULL, alt text NOT NULL,
  position text NOT NULL, mime text NOT NULL, bytes blob NOT NULL,
  created_at text NOT NULL, updated_at text NOT NULL
)`;
let initialized: Promise<void> | undefined;
export async function ensureWorkspaceMedia() {
  if (!initialized) initialized = (async () => {
    if (!env.DB) throw new Error("Workspace storage unavailable");
    await env.DB.prepare(workspaceMediaSchema).run();
  })();
  try { await initialized; } catch (error) { initialized = undefined; throw error; }
}
export async function listWorkspacePhotos() {
  await ensureWorkspaceMedia();
  const { results } = await env.DB!.prepare("SELECT id,title,alt,position FROM owner_workspace_photos ORDER BY created_at,id")
    .all<{ id: string; title: string; alt: string; position: string }>();
  return results.map(photo => ({ ...photo, src: `/api/admin/workspace/photos/${photo.id}` }));
}
export const privateMediaHeaders = {
  "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
};
export const validPhotoId = (value: string) => /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export function rasterMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return "image/jpeg";
  if ([137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)) return "image/png";
  if (String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP") return "image/webp";
  return null;
}
