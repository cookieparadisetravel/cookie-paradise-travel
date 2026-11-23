import { env } from "cloudflare:workers";
import { hashVisaToken, isVisaToken, newVisaToken, type VisaAnswers } from "./visa-information.ts";

export const visaSchema=[
`CREATE TABLE IF NOT EXISTS visa_information_emails (id TEXT PRIMARY KEY, booking_id INTEGER NOT NULL, traveler_id INTEGER NOT NULL, recipient_email TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, sent_at TEXT, message_id TEXT)`,
`CREATE INDEX IF NOT EXISTS visa_emails_traveler ON visa_information_emails(traveler_id,created_at)`,
`CREATE TABLE IF NOT EXISTS visa_information_requests (id TEXT PRIMARY KEY, traveler_id INTEGER NOT NULL REFERENCES travelers(id), booking_id INTEGER NOT NULL REFERENCES booking_requests(id), token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT, revoked_at TEXT, submission_id TEXT)`,
`CREATE INDEX IF NOT EXISTS visa_requests_traveler ON visa_information_requests(traveler_id,created_at)`,
`CREATE TABLE IF NOT EXISTS visa_information_submissions (traveler_id INTEGER PRIMARY KEY REFERENCES travelers(id), booking_id INTEGER NOT NULL REFERENCES booking_requests(id), submission_id TEXT NOT NULL, answers TEXT NOT NULL, received_at TEXT NOT NULL, consent_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS visa_information_documents (traveler_id INTEGER NOT NULL REFERENCES travelers(id), booking_id INTEGER NOT NULL REFERENCES booking_requests(id), kind TEXT NOT NULL CHECK(kind IN ('passport','portrait')), mime TEXT NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(traveler_id,kind))`,
`CREATE TABLE IF NOT EXISTS visa_information_audit (id TEXT PRIMARY KEY, booking_id INTEGER NOT NULL, traveler_id INTEGER NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL)`
];
let ready:Promise<unknown>|undefined;
export async function visaDb(){if(!env.DB)throw new Error("storage_unavailable");if(!ready)ready=env.DB.batch(visaSchema.map(sql=>env.DB!.prepare(sql)));try{await ready;}catch(e){ready=undefined;throw e;}return env.DB;}
export async function visaTraveler(bookingId:number,travelerId:number){const db=await visaDb();return db.prepare("SELECT t.id,t.first_name,t.last_name,b.departure FROM travelers t JOIN booking_requests b ON b.id=t.booking_request_id WHERE t.id=? AND b.id=?").bind(travelerId,bookingId).first<{id:number;first_name:string;last_name:string;departure:string}>();}
export async function visaAudit(bookingId:number,travelerId:number,action:string,actor:string){const db=await visaDb();await db.prepare("INSERT INTO visa_information_audit VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),bookingId,travelerId,action,actor,new Date().toISOString()).run();}
export async function createVisaRequest(bookingId:number,travelerId:number,actor:string){
  if(!await visaTraveler(bookingId,travelerId))return null;
  const db=await visaDb(),token=newVisaToken(),now=new Date().toISOString(),expiresAt=new Date(Date.now()+14*86400000).toISOString();
  await db.batch([
    db.prepare("UPDATE visa_information_requests SET revoked_at=? WHERE traveler_id=? AND booking_id=? AND revoked_at IS NULL AND completed_at IS NULL").bind(now,travelerId,bookingId),
    db.prepare("INSERT INTO visa_information_requests(id,traveler_id,booking_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),travelerId,bookingId,await hashVisaToken(token),expiresAt,now),
    db.prepare("INSERT INTO visa_information_audit VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),bookingId,travelerId,"request_created",actor,now),
  ]);return {token,expiresAt};
}
export async function resolveVisaRequest(token:string){
  if(!isVisaToken(token))return null;const db=await visaDb();
  return db.prepare(`SELECT r.id,r.booking_id,r.traveler_id,r.expires_at,r.completed_at,r.revoked_at,t.first_name,t.last_name,b.departure FROM visa_information_requests r JOIN travelers t ON t.id=r.traveler_id AND t.booking_request_id=r.booking_id JOIN booking_requests b ON b.id=r.booking_id WHERE r.token_hash=?`).bind(await hashVisaToken(token)).first<{id:string;booking_id:number;traveler_id:number;expires_at:string;completed_at:string|null;revoked_at:string|null;first_name:string;last_name:string;departure:string}>();
}
export function visaRequestState(r:Awaited<ReturnType<typeof resolveVisaRequest>>,now=Date.now()){
  if(!r||r.revoked_at)return "unavailable";if(r.completed_at)return "completed";if(!Number.isFinite(Date.parse(r.expires_at))||Date.parse(r.expires_at)<=now)return "expired";return "ready";
}
export async function submitVisaInformation(r:NonNullable<Awaited<ReturnType<typeof resolveVisaRequest>>>,answers:VisaAnswers,images:{kind:string;mime:string;bytes:Uint8Array}[]){
  const db=await visaDb(),now=new Date().toISOString(),submission=crypto.randomUUID();
  const guard="EXISTS(SELECT 1 FROM visa_information_requests WHERE id=? AND submission_id=?)";
  const result=await db.batch([
    db.prepare("UPDATE visa_information_requests SET completed_at=?,submission_id=? WHERE id=? AND completed_at IS NULL AND revoked_at IS NULL AND expires_at>?").bind(now,submission,r.id,now),
    db.prepare(`INSERT INTO visa_information_submissions(traveler_id,booking_id,submission_id,answers,received_at,consent_at,status,updated_at) SELECT ?,?,?,?,?,?,'received',? WHERE ${guard} ON CONFLICT(traveler_id) DO UPDATE SET booking_id=excluded.booking_id,submission_id=excluded.submission_id,answers=excluded.answers,received_at=excluded.received_at,consent_at=excluded.consent_at,status='received',updated_at=excluded.updated_at`).bind(r.traveler_id,r.booking_id,submission,JSON.stringify(answers),now,now,now,r.id,submission),
    ...images.map(image=>db.prepare(`INSERT INTO visa_information_documents(traveler_id,booking_id,kind,mime,bytes) SELECT ?,?,?,?,? WHERE ${guard} ON CONFLICT(traveler_id,kind) DO UPDATE SET booking_id=excluded.booking_id,mime=excluded.mime,bytes=excluded.bytes`).bind(r.traveler_id,r.booking_id,image.kind,image.mime,image.bytes.slice().buffer,r.id,submission)),
    db.prepare(`INSERT INTO visa_information_audit SELECT ?,?,?,'received','traveler',? WHERE ${guard}`).bind(crypto.randomUUID(),r.booking_id,r.traveler_id,now,r.id,submission),
  ]);return result[0].meta.changes===1;
}
