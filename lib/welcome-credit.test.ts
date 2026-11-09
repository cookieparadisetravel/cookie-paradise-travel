import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import * as credit from "./welcome-credit.ts";
import { sameOrigin, boundedBody } from "./lead-request.ts";
async function loadModule(path: string, stubs: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const key = `__credits_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  for (const statement of ts.createSourceFile("module.ts", code, ts.ScriptTarget.ESNext, true).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text, bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    assert.ok(specifier in stubs, `Missing stub: ${specifier}`);
    const exports = bindings.elements.map(b => `export const ${b.name.text}=stub[${JSON.stringify((b.propertyName ?? b.name).text)}];`).join("\n");
    const stub = `const stub=globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}];\n${exports}`;
    code = code.replace(JSON.stringify(specifier), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}

async function fixture() {
  const sqlite=new DatabaseSync(":memory:");
  function prepare(sql:string){
    let args:(string|number|null)[]=[];
    return {bind(...values:(string|number|null)[]){args=values;return this;},async run(){const result=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(result.changes)}};},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return{results:sqlite.prepare(sql).all(...args)};}};
  }
  const env={DB:{prepare,batch:async(statements:ReturnType<typeof prepare>[])=>Promise.all(statements.map(s=>s.run()))},MAILERLITE_API_TOKEN:"test-only",TURNSTILE_SECRET_KEY:"test-only",SQUARE_ENV:"production"};
  const storage=await loadModule("./welcome-credit-storage.ts",{"cloudflare:workers":{env}});
  const service=await loadModule("./welcome-credit-service.ts",{"cloudflare:workers":{env},"./welcome-credit-storage":storage,"./welcome-credit":credit});
  const access={owner:true};
  const admin=await loadModule("../app/api/admin/welcome-credits/route.ts",{"@/lib/owner-auth":{requireOwner:async()=>access.owner?{email:"owner@example.com"}:null},"@/lib/lead-request":{sameOrigin,boundedBody},"@/lib/welcome-credit":credit,"@/lib/welcome-credit-service":service});
  const publicRoute=await loadModule("../app/api/welcome-credit/route.ts",{"cloudflare:workers":{env},"@/lib/lead-request":{sameOrigin,boundedBody},"@/lib/welcome-credit":credit,"@/lib/welcome-credit-service":service});
  return{sqlite,service,storage,admin,publicRoute,access};
}
const input={name:"Test Traveler",email:"TEST@example.com",source:"/fit"};
function request(path:string,body:unknown,origin="https://example.com"){return new Request(`https://example.com${path}`,{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify(body)});}
test("credit signup requires explicit consent and a permitted source",()=>{
  const data={...input,turnstileToken:"verified",consent:true};
  assert.equal(credit.signupSchema.parse(data).email,"test@example.com");
  assert.equal(credit.signupSchema.safeParse({...data,consent:false}).success,false);
  assert.equal(credit.signupSchema.safeParse({...data,source:"/vietnam"}).success,false);
});
test("concurrent repeated signups keep one credit, preserve consent and trigger one upsert",async()=>{
  const f=await fixture(),original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(_url,options)=>{calls++;const body=JSON.parse(String(options?.body));assert.equal(body.resubscribe,false);assert.deepEqual(body.groups,[credit.welcomeGroupId]);return Response.json({data:{status:"active"}});};
  try{
    await Promise.allSettled([f.service.registerCredit(input),f.service.registerCredit({...input,email:"test@example.com"})]);
    await f.service.registerCredit(input);
    const rows=await f.service.listCredits();assert.equal(rows.length,1);assert.equal(rows[0].sync_status,"synced");assert.equal(calls,1);
    const saved=f.sqlite.prepare("SELECT consent_text,terms_text FROM welcome_credits").get();assert.equal(saved?.consent_text,credit.welcomeConsent);assert.equal(saved?.terms_text,credit.welcomeTerms);
  }finally{globalThis.fetch=original;f.sqlite.close();}
});
test("unconfirmed subscribers cannot redeem and provider failures retain retryable records",async()=>{
  const f=await fixture(),original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({data:{status:"unsubscribed"}});
  try{
    await assert.rejects(f.service.registerCredit(input));let [row]=await f.service.listCredits();assert.equal(row.sync_status,"needs_confirmation");assert.equal(await f.service.redeemCredit(row.id,"booking-1","owner"),false);
    f.sqlite.exec("UPDATE welcome_credits SET sync_attempt_at=NULL");
    globalThis.fetch=async()=>{throw new Error("network unavailable");};await assert.rejects(f.service.registerCredit(input));[row]=await f.service.listCredits();assert.equal(row.sync_status,"error");
    f.sqlite.exec("UPDATE welcome_credits SET sync_attempt_at=NULL");globalThis.fetch=async()=>Response.json({data:{status:"active"}});await f.service.registerCredit(input);assert.equal((await f.service.listCredits())[0].sync_status,"synced");
  }finally{globalThis.fetch=original;f.sqlite.close();}
});
test("redemption is atomic, a booking cannot receive two credits, and resubmission cannot reset used credit",async()=>{
  const f=await fixture(),original=globalThis.fetch;globalThis.fetch=async()=>Response.json({data:{status:"active"}});
  try{
    await f.service.registerCredit(input);await f.service.registerCredit({...input,email:"second@example.com"});
    const rows=await f.service.listCredits(),first=rows.find((r:credit.WelcomeCredit)=>r.email==="test@example.com")!,second=rows.find((r:credit.WelcomeCredit)=>r.email==="second@example.com")!;
    const result=await Promise.all([f.service.redeemCredit(first.id,"INV-123","owner"),f.service.redeemCredit(first.id,"INV-456","owner")]);assert.equal(result.filter(Boolean).length,1);
    await assert.rejects(f.service.redeemCredit(second.id,"inv-123","owner"));await f.service.registerCredit(input);
    assert.ok((await f.service.listCredits("test@example.com"))[0].redeemed_at);assert.equal(await f.service.redeemCredit(first.id,"newbooking","owner"),false);
  }finally{globalThis.fetch=original;f.sqlite.close();}
});
test("rate limit is atomic and owner mutations reject unauthorized or cross-origin calls",async()=>{
  const f=await fixture();
  try{
    const results=await Promise.all(Array.from({length:15},()=>f.service.allowCreditSignup("203.0.113.1")));assert.equal(results.filter(Boolean).length,10);
    f.access.owner=false;assert.equal((await f.admin.POST(request("/api/admin/welcome-credits",{}))).status,401);
    f.access.owner=true;assert.equal((await f.admin.POST(request("/api/admin/welcome-credits",{},"https://other.example"))).status,403);
    assert.equal((await f.admin.POST(request("/api/admin/welcome-credits",{id:crypto.randomUUID(),bookingReference:"inv-123",applied:false}))).status,400);
  }finally{f.sqlite.close();}
});
test("signup rejects cross-origin, absent consent and wrong verification action before persisting",async()=>{
  const f=await fixture(),original=globalThis.fetch;globalThis.fetch=async()=>Response.json({success:true,hostname:"example.com",action:"booking_inquiry"});
  try{
    const data={...input,consent:true,turnstileToken:"test"};
    assert.equal((await f.publicRoute.POST(request("/api/welcome-credit",data,"https://other.example"))).status,403);
    assert.equal((await f.publicRoute.POST(request("/api/welcome-credit",{...data,consent:false}))).status,400);
    assert.equal((await f.publicRoute.POST(request("/api/welcome-credit",data))).status,400);
    assert.equal((await f.service.listCredits()).length,0);
  }finally{globalThis.fetch=original;f.sqlite.close();}
});
