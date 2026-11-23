import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { loadModule } from "../test-support/lead-fixture.ts";
import * as emailCopy from "./visa-information-email.ts";
import * as config from "./visa-information.ts";
const origin="https://example.test";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=","base64");
function answers(){const data:Record<string,string>={};for(const f of config.visaFields)if(f.required)data[f.key]=f.options?.[0]??"Example";return {...data,givenNames:"Test Traveler",dateOfBirth:"1980-02-20",email:"test@example.test",passportIssueDate:"2020-01-01",passportExpiryDate:"2030-01-01",passportNumber:"TEST12345",datesConfirmed:"Not yet",insurance:"No"};}
async function fixture(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON;CREATE TABLE booking_requests(id INTEGER PRIMARY KEY,departure TEXT);CREATE TABLE travelers(id INTEGER PRIMARY KEY,booking_request_id INTEGER,first_name TEXT,last_name TEXT,email TEXT,traveler_type TEXT,guardian_legal_name TEXT);INSERT INTO booking_requests VALUES (1,'2027-06-01'),(2,'2027-12-27');INSERT INTO travelers VALUES (1,1,'Test','Traveler','test@example.test','adult',NULL),(2,2,'Other','Traveler','other@example.test','adult',NULL);");
  let queries=0;const access={owner:true};
  function prepare(sql:string){queries++;let params:unknown[]=[];return {bind(...values:unknown[]){params=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;},execute(){const statement=sqlite.prepare(sql);if(statement.columns().length)return {results:statement.all(...params as never[]),meta:{changes:0}};return {results:[],meta:{changes:Number(statement.run(...params as never[]).changes)}};},async run(){return this.execute();},async first(){return sqlite.prepare(sql).get(...params as never[])??null;},async all(){return {results:sqlite.prepare(sql).all(...params as never[])};}};}
  const db={prepare,async batch(statements:ReturnType<typeof prepare>[]){sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
  const storage=await loadModule<typeof import("./visa-information-storage")>("lib/visa-information-storage.ts",{"cloudflare:workers":{env:{DB:db}},"./visa-information.ts":config});
  const stubs={"@/lib/visa-information":config,"@/lib/visa-information-storage":storage,"@/lib/owner-auth":{requireOwner:async()=>access.owner?{email:"owner@example.test"}:null},zod:{z}};
  const admin=await loadModule<typeof import("../app/api/admin/inquiries/[id]/visa-information/route")>("app/api/admin/inquiries/[id]/visa-information/route.ts",stubs);
  const publicApi=await loadModule<typeof import("../app/api/visa-information/route")>("app/api/visa-information/route.ts",stubs);
  const documents=await loadModule<typeof import("../app/api/admin/inquiries/[id]/visa-information/documents/[travelerId]/[kind]/route")>("app/api/admin/inquiries/[id]/visa-information/documents/[travelerId]/[kind]/route.ts",stubs);
  const mail={configured:true,fail:false,calls:[] as Record<string,unknown>[]};
  const emailRoute=await loadModule<typeof import("../app/api/admin/inquiries/[id]/visa-information/email/route")>("app/api/admin/inquiries/[id]/visa-information/email/route.ts",{...stubs,"@/lib/visa-information-email":emailCopy,"@/lib/mailersend-transactional":{transactionalEmailConfigured:()=>mail.configured,sendVisaInformationEmail:async(input:Record<string,unknown>)=>{mail.calls.push(input);if(mail.fail)throw new Error("SECRET PROVIDER RESPONSE");return {sentAt:new Date().toISOString(),messageId:"synthetic-id"};}}});
  const emailRequest=(operationId=crypto.randomUUID(),travelerId=1,expectedEmail="test@example.test",requestOrigin:string|null=origin)=>new Request(`${origin}/api/admin/inquiries/1/visa-information/email`,{method:"POST",headers:{"Content-Type":"application/json",...(requestOrigin?{Origin:requestOrigin}:{})},body:JSON.stringify({operationId,travelerId,expectedEmail})});
  const ctx=(id="1")=>({params:Promise.resolve({id})});
  const adminRequest=(action:string,travelerId=1,requestOrigin:string|null=origin)=>new Request(`${origin}/api/admin/inquiries/1/visa-information`,{method:"POST",headers:{"Content-Type":"application/json",...(requestOrigin?{Origin:requestOrigin}:{})},body:JSON.stringify({travelerId,action})});
  const get=(token:string)=>new Request(`${origin}/api/visa-information`,{headers:{Authorization:`Bearer ${token}`}});
  const post=(token:string,payload:unknown={answers:answers(),consent:true},image:Uint8Array=png)=>{const form=new FormData();form.set("payload",JSON.stringify(payload));for(const kind of ["passport","portrait"])form.set(kind,new Blob([new Uint8Array(image)],{type:"image/png"}),`${kind}.png`);return new Request(`${origin}/api/visa-information`,{method:"POST",headers:{Origin:origin,Authorization:`Bearer ${token}`},body:form});};
  return {sqlite,storage,admin,publicApi,documents,emailRoute,emailRequest,mail,ctx,adminRequest,get,post,access,queries:()=>queries};
}
test("owner authentication and same-origin checks precede all private storage access",async()=>{
 const f=await fixture();f.access.owner=false;
 assert.equal((await f.admin.GET(new Request(origin),f.ctx())).status,403);
 assert.equal((await f.admin.POST(f.adminRequest("request"),f.ctx())).status,403);
 assert.equal((await f.documents.GET(new Request(origin),{params:Promise.resolve({id:"1",travelerId:"1",kind:"passport"})})).status,403);
 f.access.owner=true;for(const value of [null,"https://attacker.test"])assert.equal((await f.admin.POST(f.adminRequest("request",1,value),f.ctx())).status,403);
 assert.equal(f.queries(),0);f.sqlite.close();
});
test("request links are scoped to a traveler, hashed, expiring, and replace old unused links",async()=>{
 const f=await fixture();assert.equal((await f.admin.POST(f.adminRequest("request",2),f.ctx())).status,404);
 const first=await f.storage.createVisaRequest(1,1,"owner");assert.ok(first);const stored=f.sqlite.prepare("SELECT token_hash FROM visa_information_requests").get()!;assert.notEqual(stored.token_hash,first.token);assert.equal(String(stored.token_hash).length,64);
 assert.equal(f.storage.visaRequestState(await f.storage.resolveVisaRequest(first.token)),"ready");
 const second=await f.storage.createVisaRequest(1,1,"owner");assert.ok(second);assert.equal(f.storage.visaRequestState(await f.storage.resolveVisaRequest(first.token)),"unavailable");
 f.sqlite.prepare("UPDATE visa_information_requests SET expires_at='2000-01-01' WHERE revoked_at IS NULL").run();assert.equal((await f.publicApi.GET(f.get(second.token))).status,410);assert.equal((await f.publicApi.POST(f.post(second.token))).status,410);
 assert.equal(await f.storage.resolveVisaRequest("bad"),null);f.sqlite.close();
});
test("public submission stores answers and both photos atomically; bearer link cannot read them or submit twice",async()=>{
 const f=await fixture();const invite=(await f.storage.createVisaRequest(1,1,"owner"))!;
 const metadata=await f.publicApi.GET(f.get(invite.token));assert.equal(metadata.headers.get("cache-control"),"private, no-store");assert.doesNotMatch(await metadata.text(),/TEST12345|answers|email/);
 const saved=await f.publicApi.POST(f.post(invite.token));assert.equal(saved.status,200);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM visa_information_documents").get()!.n,2);
 const complete=await (await f.publicApi.GET(f.get(invite.token))).json();assert.deepEqual(complete,{state:"completed"});assert.equal((await f.publicApi.POST(f.post(invite.token))).status,410);
 const reviewed=await f.admin.POST(f.adminRequest("view"),f.ctx());assert.equal(reviewed.status,200);assert.match(await reviewed.text(),/TEST12345/);
 const listing=await f.admin.GET(new Request(origin),f.ctx());assert.doesNotMatch(await listing.text(),/TEST12345|passportNumber/);
 const photo=await f.documents.GET(new Request(origin),{params:Promise.resolve({id:"1",travelerId:"1",kind:"passport"})});assert.equal(photo.status,200);assert.deepEqual(Buffer.from(await photo.arrayBuffer()),png);assert.match(photo.headers.get("content-disposition")!,/attachment/);assert.equal(photo.headers.get("cache-control"),"private, no-store");
 assert.equal((await f.documents.GET(new Request(origin),{params:Promise.resolve({id:"2",travelerId:"1",kind:"passport"})})).status,404);
 assert.equal((await f.admin.POST(f.adminRequest("view",1),f.ctx("2"))).status,404);f.sqlite.close();
});
test("stale submission attempts cannot overwrite a completed response, and failures roll back the token claim",async()=>{
 const f=await fixture();const invite=(await f.storage.createVisaRequest(1,1,"owner"))!,record=(await f.storage.resolveVisaRequest(invite.token))!;
 const images=[{kind:"passport",mime:"image/png",bytes:png},{kind:"portrait",mime:"image/png",bytes:png}];
 await assert.rejects(f.storage.submitVisaInformation(record,answers(),[{kind:"invalid",mime:"image/png",bytes:png}]));assert.equal(f.storage.visaRequestState(await f.storage.resolveVisaRequest(invite.token)),"ready");
 assert.equal(await f.storage.submitVisaInformation(record,answers(),images),true);assert.equal(await f.storage.submitVisaInformation(record,{...answers(),passportNumber:"CHANGED"},images),false);
 assert.match(String(f.sqlite.prepare("SELECT answers FROM visa_information_submissions").get()!.answers),/TEST12345/);f.sqlite.close();
});
test("validation rejects missing consent, invalid conditional fields, forged keys, invalid dates, nonimages and oversized bodies",async()=>{
 const f=await fixture(),invite=(await f.storage.createVisaRequest(1,1,"owner"))!;
 for(const payload of [{answers:answers(),consent:false},{answers:{...answers(),otherPassports:"Yes"},consent:true},{answers:{...answers(),dateOfBirth:"1980-02-31"},consent:true},{answers:{...answers(),plannedArrival:"2027-06-08",plannedDeparture:"2027-06-01"},consent:true},{answers:answers(),consent:true,travelerId:2}])assert.equal((await f.publicApi.POST(f.post(invite.token,payload))).status,400);
 assert.equal((await f.publicApi.POST(f.post(invite.token,undefined,new TextEncoder().encode('<svg onload="evil()"></svg>')))).status,400);
 const oversized=new Request(`${origin}/api/visa-information`,{method:"POST",headers:{Origin:origin,Authorization:`Bearer ${invite.token}`},body:"x".repeat(config.MAX_VISA_REQUEST_BYTES+1)});assert.equal((await f.publicApi.POST(oversized)).status,413);
 const csrf=f.post(invite.token);csrf.headers.delete("origin");assert.equal((await f.publicApi.POST(csrf)).status,403);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM visa_information_submissions").get()!.n,0);f.sqlite.close();
});
test("replacement submission updates only its traveler; deletion removes data and disables links",async()=>{
 const f=await fixture();const first=(await f.storage.createVisaRequest(1,1,"owner"))!;await f.publicApi.POST(f.post(first.token));
 const replacement=(await f.storage.createVisaRequest(1,1,"owner"))!;assert.equal((await f.publicApi.POST(f.post(replacement.token,{answers:{...answers(),passportNumber:"CORRECTED"},consent:true}))).status,200);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM visa_information_submissions").get()!.n,1);assert.match(String(f.sqlite.prepare("SELECT answers FROM visa_information_submissions").get()!.answers),/CORRECTED/);
 const unused=(await f.storage.createVisaRequest(1,1,"owner"))!;assert.equal((await f.admin.POST(f.adminRequest("delete"),f.ctx())).status,200);
 assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM visa_information_documents").get()!.n,0);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM visa_information_submissions").get()!.n,0);
 assert.equal((await f.publicApi.GET(f.get(unused.token))).status,410);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM travelers").get()!.n,2);f.sqlite.close();
});

test("visa email checks authorization, scope, recipient and configuration before creating links",async()=>{
 const f=await fixture();f.access.owner=false;
 assert.equal((await f.emailRoute.POST(f.emailRequest(),f.ctx())).status,403);f.access.owner=true;
 assert.equal((await f.emailRoute.POST(f.emailRequest(undefined,1,"test@example.test",null),f.ctx())).status,403);
 assert.equal(f.queries(),0);
 assert.equal((await f.emailRoute.POST(f.emailRequest(undefined,2),f.ctx())).status,404);
 assert.equal((await f.emailRoute.POST(f.emailRequest(undefined,1,"wrong@example.test"),f.ctx())).status,409);
 f.mail.configured=false;assert.equal((await f.emailRoute.POST(f.emailRequest(),f.ctx())).status,503);
 assert.equal(f.mail.calls.length,0);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM visa_information_requests").get()!.n,0);f.sqlite.close();
});
test("visa email sends one personalized button link, expiring in fourteen days, with replay protection",async()=>{
 const f=await fixture(),operation=crypto.randomUUID();
 assert.equal((await f.emailRoute.POST(f.emailRequest(operation),f.ctx())).status,200);
 assert.equal((await f.emailRoute.POST(f.emailRequest(operation),f.ctx())).status,200);
 assert.equal((await f.emailRoute.POST(f.emailRequest(),f.ctx())).status,409);
 assert.equal(f.mail.calls.length,1);const sent=f.mail.calls[0];assert.equal(sent.toEmail,"test@example.test");assert.match(String(sent.html),/Hi Test,/);assert.match(String(sent.html),/>Complete visa information form<\/a>/);
 const token=String(sent.text).match(/#token=([a-f0-9]{64})/)![1],request=await f.storage.resolveVisaRequest(token);assert.ok(request);assert.equal(f.storage.visaRequestState(request),"ready");assert.ok(Math.abs(Date.parse(request.expires_at)-Date.now()-14*86400000)<5000);
 assert.equal(JSON.stringify(f.sqlite.prepare("SELECT * FROM visa_information_emails").get()).includes(token),false);
 const metadata=await (await f.admin.GET(new Request(origin),f.ctx())).json() as {travelers:{email_status:string}[]};assert.equal(metadata.travelers[0].email_status,"accepted");f.sqlite.close();
});
test("uncertain email delivery does not retry or invalidate the emailed link",async()=>{
 const f=await fixture();f.mail.fail=true;const operation=crypto.randomUUID();
 const response=await f.emailRoute.POST(f.emailRequest(operation),f.ctx());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/SECRET/);
 assert.equal((await f.emailRoute.POST(f.emailRequest(operation),f.ctx())).status,409);assert.equal(f.mail.calls.length,1);
 const token=String(f.mail.calls[0].text).match(/#token=([a-f0-9]{64})/)![1];assert.equal(f.storage.visaRequestState(await f.storage.resolveVisaRequest(token)),"ready");f.sqlite.close();
});
test("email template escapes names, validates private URL and addresses the guardian for minors",()=>{
 const traveler={first_name:"Child <script>",last_name:"Example",traveler_type:"minor",guardian_legal_name:"Parent & Guardian"};
 const result=emailCopy.buildVisaEmail(traveler,"https://cookieparadisetravel.com/visa-information#token="+"a".repeat(64));
 assert.match(result.html,/Hi Parent &amp; Guardian/);assert.doesNotMatch(result.html,/<script>/);assert.match(result.text,/Child <script>’s passport/);
 assert.throws(()=>emailCopy.buildVisaEmail(traveler,"https://attacker.test/visa-information#token="+"a".repeat(64)));
});
test("private request email disables link, open and content tracking at the mail provider",async()=>{
 const mailer=await loadModule<typeof import("./mailersend-transactional")>("lib/mailersend-transactional.ts",{"cloudflare:workers":{env:{MAILERSEND_API_TOKEN:"test-only",MAILERSEND_FROM_EMAIL:"sender@example.test"}},"./consultation":{consultationBookingUrl:"https://example.test/consultation"},"./travel-disclosures":{travelDisclosureEmailHtml:()=>"<footer>Company footer</footer>",travelDisclosureText:()=>"Company footer"}});
 const original=globalThis.fetch;let body:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response(null,{status:202,headers:{"x-message-id":"synthetic"}});};
 try{const result=await mailer.sendVisaInformationEmail({toEmail:"test@example.test",toName:"Test",subject:"Test",html:"<p>Private link</p>",text:"Private link"});assert.equal(result.messageId,"synthetic");assert.deepEqual(body!.settings,{track_clicks:false,track_opens:false,track_content:false});assert.match(String(body!.html),/Company footer/);}
 finally{globalThis.fetch=original;}
});
