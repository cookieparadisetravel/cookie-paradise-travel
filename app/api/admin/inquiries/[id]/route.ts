import { bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { isOwnerRequest } from "@/lib/owner-auth";

const validStatuses = new Set(["new", "contacted", "qualified", "waitlist", "closed"]);

function hasValidOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await isOwnerRequest())) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  const payload = await request.json() as { status?: unknown };
  const status = String(payload.status ?? "");
  if (!Number.isInteger(id) || id < 1 || !validStatuses.has(status)) {
    return Response.json({ error: "Invalid inquiry or status" }, { status: 400 });
  }

  await getDb().update(bookingRequests).set({ status }).where(eq(bookingRequests.id, id));
  return Response.json({ ok: true });
}
