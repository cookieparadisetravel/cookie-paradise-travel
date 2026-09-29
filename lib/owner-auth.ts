import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type AccessOwner = {
  email: string;
  displayName: string;
  payload: JWTPayload;
};

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function accessConfig() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const teamDomain = runtimeEnv.CF_ACCESS_TEAM_DOMAIN?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const audience = runtimeEnv.CF_ACCESS_AUD?.trim();
  const ownerEmail = runtimeEnv.ADMIN_OWNER_EMAIL?.trim().toLowerCase();

  if (!teamDomain || !audience || !ownerEmail) return null;

  const issuer = `https://${teamDomain}`;
  return {
    audience,
    ownerEmail,
    issuer,
    certsUrl: `${issuer}/cdn-cgi/access/certs`,
  };
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim() || null;
  }

  return null;
}

async function verifiedOwner(): Promise<AccessOwner | null> {
  const config = accessConfig();
  if (!config) return null;

  const requestHeaders = await headers();
  const token = requestHeaders.get("Cf-Access-Jwt-Assertion")
    ?? cookieValue(requestHeaders.get("cookie"), "CF_Authorization");
  if (!token) return null;

  try {
    let jwks = jwksByUrl.get(config.certsUrl);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(config.certsUrl));
      jwksByUrl.set(config.certsUrl, jwks);
    }

    const { payload } = await jwtVerify(token, jwks, {
      audience: config.audience,
      issuer: config.issuer,
      algorithms: ["RS256"],
      requiredClaims: ["exp"],
    });
    const email = typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";

    if (!email || email !== config.ownerEmail) return null;

    return {
      email,
      displayName: email,
      payload,
    };
  } catch (error) {
    console.warn("Cloudflare Access authentication failed", error);
    return null;
  }
}

export async function requireOwner(returnTo: string) {
  void returnTo;
  return verifiedOwner();
}

export async function isOwnerRequest() {
  return Boolean(await verifiedOwner());
}
