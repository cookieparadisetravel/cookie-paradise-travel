import { getChatGPTUser, requireChatGPTUser } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";

function ownerConfig() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return {
    ownerUserId: runtimeEnv.ADMIN_OWNER_USER_ID,
    ownerEmail: runtimeEnv.ADMIN_OWNER_EMAIL?.toLowerCase(),
  };
}

export async function requireOwner(returnTo: string) {
  const user = await requireChatGPTUser(returnTo);
  const { ownerUserId, ownerEmail } = ownerConfig();
  if (!ownerUserId && !ownerEmail) return null;
  if (ownerUserId && user.userId === ownerUserId) return user;
  if (ownerEmail && user.email.toLowerCase() === ownerEmail) return user;
  return null;
}

export async function isOwnerRequest() {
  const user = await getChatGPTUser();
  if (!user) return false;
  const { ownerUserId, ownerEmail } = ownerConfig();
  return Boolean(
    (ownerUserId && user.userId === ownerUserId) ||
    (ownerEmail && user.email.toLowerCase() === ownerEmail),
  );
}
