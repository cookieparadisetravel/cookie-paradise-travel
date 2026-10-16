import { env } from "cloudflare:workers";
import { SignJWT, importPKCS8 } from "jose";
import { consultationTitle } from "./consultation";

type CalendarEvent = {
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: { email?: string; organizer?: boolean }[];
};

export function isCustomerConsultation(event: CalendarEvent, email: string) {
  if (event.status === "cancelled") return false;
  if (!event.summary?.startsWith(consultationTitle)) return false;
  const duration = Date.parse(event.end?.dateTime ?? "") - Date.parse(event.start?.dateTime ?? "");
  if (duration !== 30 * 60_000) return false;
  const normalized = email.trim().toLowerCase();
  if (event.attendees?.some((a) => !a.organizer && a.email?.trim().toLowerCase() === normalized)) return true;
  // Appointment schedules include the booking email in their generated Booked by section.
  const bookedBy = event.description?.split(/\*\*Booked by\*\*|<b>Booked by<\/b>/iu)[1]?.split(/\n\s*\n|<br\s*\/?>(?:\s*<br\s*\/?>)/iu)[0];
  const emails = bookedBy?.match(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [];
  return emails.some((address) => address.toLowerCase() === normalized);
}

let cachedToken: { key: string; token: string; expiresAt: number } | undefined;
const tokenUrl = "https://oauth2.googleapis.com/token";

async function accessToken() {
  const raw = env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Consultation calendar credentials are unavailable.");
  if (cachedToken?.key === raw && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const credentials = JSON.parse(raw) as { client_email?: string; private_key?: string; type?: string };
  if (credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) {
    throw new Error("Consultation calendar credentials are invalid.");
  }
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/calendar.events.readonly" })
    .setProtectedHeader({ alg: "RS256" }).setIssuer(credentials.client_email).setAudience(tokenUrl)
    .setIssuedAt().setExpirationTime("5m").sign(await importPKCS8(credentials.private_key, "RS256"));
  const response = await fetch(tokenUrl, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Consultation calendar authorization failed.");
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token || !Number.isFinite(data.expires_in) || data.expires_in! <= 60) throw new Error("Invalid calendar authorization response.");
  cachedToken = { key: raw, token: data.access_token, expiresAt: Date.now() + data.expires_in! * 1000 };
  return cachedToken.token;
}

/** Fresh event lookup for every delivery. Errors must prevent sending, never mean 'not booked'. */
export async function hasBookedConsultation(email: string) {
  const calendarId = env.CONSULTATION_CALENDAR_ID;
  if (!calendarId) throw new Error("Consultation calendar is unavailable.");
  const token = await accessToken();
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.search = new URLSearchParams({ q: email.trim().toLowerCase(), singleEvents: "true", showDeleted: "false", maxResults: "250", fields: "accessRole,nextPageToken,items(status,summary,description,start,end,attendees(email,organizer))", ...(pageToken ? { pageToken } : {}) }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Consultation calendar lookup failed.");
    const data = await response.json() as { accessRole?: string; items?: CalendarEvent[]; nextPageToken?: string };
    if (!["reader", "writer", "owner"].includes(data.accessRole ?? "") || !Array.isArray(data.items)) {
      throw new Error("Consultation calendar details are unavailable.");
    }
    if (data.items.some((event) => isCustomerConsultation(event, email))) return true;
    if (!data.nextPageToken) return false;
    pageToken = data.nextPageToken;
  }
  throw new Error("Consultation calendar lookup was incomplete.");
}
