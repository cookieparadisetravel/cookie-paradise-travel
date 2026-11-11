import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { loadModule } from "../test-support/lead-fixture.ts";
const png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=";
async function fixture(authorized=true){
  const sqlite=new DatabaseSync(":memory:");let reads=0;
  const db={prepare(sql:string){reads++;let bindings:unknown[]=[];return {bind(...values:unknown[]){bindings=values.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value);return this;},async run(){const result=sqlite.prepare(sql).run(...bindings as never[]);return {meta:{changes:Number(result.changes)}};},async first(){return sqlite.prepare(sql).get(...bindings as never[])??null;},async all(){return {results:sqlite.prepare(sql).all(...bindings as never[])};}};}};
  const runtime={DB:db};
  const storage=await loadModule<typeof import("./workspace-media")>("lib/workspace-media.ts",{"cloudflare:workers":{env:runtime}});
  const stubs={"cloudflare:workers":{env:runtime},"@/lib/workspace-media":storage,"@/lib/owner-auth":{requireOwner:async()=>authorized?{email:"owner@example.test"}:null}};
  const api=await loadModule<typeof import("../app/api/admin/workspace/photos/route")>("app/api/admin/workspace/photos/route.ts",stubs);
  const image=await loadModule<typeof import("../app/api/admin/workspace/photos/[id]/route")>("app/api/admin/workspace/photos/[id]/route.ts",stubs);
  const request=(payload:unknown,origin:string|null="https://example.test")=>new Request("https://example.test/api/admin/workspace/photos",{method:"POST",headers:{"Content-Type":"application/json",...(origin?{Origin:origin}:{})},body:JSON.stringify(payload)});
  return {storage,api,image,sqlite,reads:()=>reads,request};
}
const photo=(id="test-photo")=>({id,title:"Test photo",alt:"Synthetic test image",position:"50% 35%",data:png});
test("workspace media denies unauthenticated listing, uploads and image reads before touching storage",async()=>{
 const f=await fixture(false);for(const response of [await f.api.GET(),await f.api.POST(f.request(photo())),await f.image.GET(new Request("https://example.test"),{params:Promise.resolve({id:"test-photo"})})]){assert.equal(response.status,403);assert.equal(response.headers.get("Cache-Control"),"private, no-store");}assert.equal(f.reads(),0);
});
test("workspace uploads require same-origin Origin, validate raster types and enforce streamed size",async()=>{
 const f=await fixture();for(const origin of [null,"https://other.test"]){assert.equal((await f.api.POST(f.request(photo(),origin))).status,403);}assert.equal(f.reads(),0);
 assert.equal((await f.api.POST(f.request({...photo(),data:btoa('<svg onload="alert(1)"></svg>')}))).status,400);
 assert.equal((await f.api.POST(f.request({...photo(),id:"../private"}))).status,400);
 assert.equal((await f.api.POST(f.request({...photo(),position:"101% 50%"}))).status,400);
 assert.equal((await f.api.POST(f.request({...photo(),data:"x".repeat(2_100_001)}))).status,413);assert.equal(f.reads(),0);
});
test("private photo bytes round-trip and never appear in collection metadata",async()=>{
 const f=await fixture();assert.equal((await f.api.POST(f.request(photo()))).status,200);
 const list=await f.api.GET();const body=await list.json() as {photos:unknown[]};assert.deepEqual(body.photos,[{id:"test-photo",title:"Test photo",alt:"Synthetic test image",position:"50% 35%",src:"/api/admin/workspace/photos/test-photo"}]);
 const response=await f.image.GET(new Request("https://example.test"),{params:Promise.resolve({id:"test-photo"})});assert.equal(response.status,200);assert.equal(response.headers.get("Content-Type"),"image/png");assert.equal(response.headers.get("Cache-Control"),"private, no-store");assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");assert.equal(Buffer.from(await response.arrayBuffer()).toString("base64"),png);
 assert.equal((await f.image.GET(new Request("https://example.test"),{params:Promise.resolve({id:"missing"})})).status,404);
});
test("photo cap is atomic and existing photos can be updated without duplicating the collection",async()=>{
 const f=await fixture();for(let i=0;i<50;i++)assert.equal((await f.api.POST(f.request(photo(`photo-${i}`)))).status,200);
 assert.equal((await f.api.POST(f.request(photo("one-too-many")))).status,409);
 assert.equal((await f.api.POST(f.request({...photo("photo-0"),title:"Updated"}))).status,200);
 assert.equal(f.sqlite.prepare("SELECT count(*) total FROM owner_workspace_photos").get()?.total,50);
 assert.equal(f.sqlite.prepare("SELECT title FROM owner_workspace_photos WHERE id='photo-0'").get()?.title,"Updated");
});
