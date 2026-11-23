import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { loadModule } from "../test-support/lead-fixture.ts";
import * as config from "./visa-information.ts";
const origin="https://example.test";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=","base64");
function answers(){const data:Record<string,string>={};for(const f of config.visaFields)if(f.required)data[f.key]=f.options?.[0]??"Example";return {...data,givenNames:"Test Traveler",dateOfBirth:"1980-02-20",email:"test@example.test",passportIssueDate:"2020-01-01",passportExpiryDate:"2030-01-01",passportNumber:"TEST12345",datesConfirmed:"Not yet",insurance:"No"};}
async function fixture(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON;CREATE TABLE booking_requests(id INTEGER PRIMARY KEY,departure TEXT);CREATE TABLE travelers(id INTEGER PRIMARY KEY,booking_request_id INTEGER,first_name TEXT,last_name TEXT);INSERT INTO booking_requests VALUES (1,'2027-06-01'),(2,'2027-12-27');INSERT INTO travelers VALUES (1,1,'Test','Traveler'),(2,2,'Other','Traveler');");
  let queries=0;const access={owner:true};
  function prepare(sql:string){queries++;let params:unknown[]=[];return {bind(...values:unknown[]){params=values.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;},execute(){const statement=sqlite.prepare(sql);if(statement.columns().length)return {results:statement.all(...params as never[]),meta:{changes:0}};return {results:[],meta:{changes:Number(statement.run(...params as never[]).changes)}};},async run(){return this.execute();},async first(){return sqlite.prepare(sql).get(...params as never[])??null;},async all(){return {results:sqlite.prepare(sql).all(...params as never[])};}};}
  const db={prepare,async batch(statements:ReturnType<typeof prepare>[]){sqlite.exec("BEGIN");try{const result=statements.map(s=>s.execute());sqlite.exec("COMMIT");return result;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
  const storage=await loadModule<typeof import("./visa-information-storage")>("lib/visa-information-storage.ts",{"cloudflare:workers":{env:{DB:db}},"./visa-information.ts":config});
  const stubs={"@/lib/visa-information":config,"@/lib/visa-information-storage":storage,"@/lib/owner-auth":{requireOwner:async()=>access.owner?{email:"owner@example.test"}:null},zod:{z}};
  const admin=await loadModule<typeof import("../app/api/admin/inquiries/[id]/visa-information/route")>("app/api/admin/inquiries/[id]/visa-information/route.ts",stubs);
  const publicApi=await loadModule<typeof import("../app/api/visa-information/route")>("app/api/visa-information/route.ts",stubs);
  const documents=await loadModule<typeof import("../app/api/admin/inquiries/[id]/visa-information/documents/[travelerId]/[kind]/route")>("app/api/admin/inquiries/[id]/visa-information/documents/[travelerId]/[kind]/route.ts",stubs);
  const ctx=(id="1")=>({params:Promise.resolve({id})});
  const adminRequest=(action:string,travelerId=1,requestOrigin:string|null=origin)=>new Request(`${origin}/api/admin/inquiries/1/visa-information`,{method:"POST",headers:{"Content-Type":"application/json",...(requestOrigin?{Origin:requestOrigin}:{})},body:JSON.stringify({travelerId,action})});
  const get=(token:string)=>new Request(`${origin}/api/visa-information`,{headers:{Authorization:`Bearer ${token}`}});
  const post=(token:string,payload:unknown={answers:answers(),consent:true},image:Uint8Array=png)=>{const form=new FormData();form.set("payload",JSON.stringify(payload));for(const kind of ["passport","portrait"])form.set(kind,new Blob([new Uint8Array(image)],{type:"image/png"}),`${kind}.png`);return new Request(`${origin}/api/visa-information`,{method:"POST",headers:{Origin:origin,Authorization:`Bearer ${token}`},body:form});};
  return {sqlite,storage,admin,publicApi,documents,ctx,adminRequest,get,post,access,queries:()=>queries};
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
