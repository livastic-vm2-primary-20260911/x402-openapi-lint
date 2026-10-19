import test from "node:test";
import assert from "node:assert/strict";
import {parseGlbBase64} from "../glb-analyzer.mjs";
import {makeDiscovery} from "../discovery.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const gen=(query="",headers={})=>fetch(BASE+"/v1/generate-lowpoly"+query,{headers});

test("Original procedural lowpoly free sample is honestly unsold and discloses public source",async()=>{
 const r=await fetch(BASE+"/v1/lowpoly-sample");
 assert.equal(r.status,200);
 const x=await r.json();
 assert.equal(x.paid,false);assert.equal(x.priceUSDC,"0.05");
 assert.deepEqual(x.kinds,["lantern","marker"]);assert.equal(x.confirmedSettledSalesUSDC,"0");
 assert.equal(r.headers.get("payment-required"),null);
});
test("Invalid kind and seed are 400 BEFORE any payment, never a payment challenge",async()=>{
 for(const query of ["?kind=cow","?kind=marker&seed=-1","?seed=1.2","?seed=1000000",
   "?seed=10&seed=11","?private=1","?kind=lantern&apiKey=secret","?seed=0002"]){
  const r=await gen(query);assert.equal(r.status,400,query);
  assert.equal((await r.json()).charged,false);
  assert.equal(r.headers.get("payment-required"),null);
 }
});
test("Valid default GET without keys is 402 on Base at 0.05 native Circle USDC",async()=>{
 const r=await gen();
 assert.equal(r.status,402);
 const h=r.headers.get("payment-required");assert.ok(h);
 const pay=JSON.parse(Buffer.from(h,"base64").toString());
 assert.equal(pay.x402Version,2);assert.equal(pay.accepts[0].network,"eip155:8453");
 assert.equal(pay.accepts[0].amount,"50000");
 assert.equal(pay.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(pay.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 assert.ok(pay.resource.url.includes("/v1/generate-lowpoly"));
});
test("LOCAL MOCK ONLY: known signed marker unlocks deterministic original model, not an actual onchain payment",async()=>{
 const query="?kind=marker&seed=271";
 const before=await gen(query);assert.equal(before.status,402);
 const q=JSON.parse(Buffer.from(before.headers.get("payment-required"),"base64").toString());
 const marker="0x"+"11".repeat(65);
 const pay=Buffer.from(JSON.stringify({
   x402Version:2,resource:q.resource,accepted:q.accepts[0],extensions:q.extensions||{},
   payload:{signature:marker,authorization:{
    from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,
    value:q.accepts[0].amount,validAfter:"0",validBefore:"9999999999",
    nonce:"0x"+"44".repeat(32)
   }}
 })).toString("base64");
 const resp=await gen(query,{"PAYMENT-SIGNATURE":pay});
 assert.equal(resp.status,200);
 const json=await resp.json();
 assert.equal(json.ok,true);assert.equal(json.paid,true);
 assert.equal(json.chargedUSDC,"0.05");
 assert.equal(json.kind,"marker");assert.equal(json.seed,271);
 assert.ok(json.fileName.endsWith(".glb"));
 assert.ok(json.disclosure.includes("source is public"));
 const output=parseGlbBase64(json.glbBase64);
 assert.equal(output.ok,true,output.error);
 assert.equal(output.triangleCount,json.triangles);
 const receipt=resp.headers.get("payment-response");
 assert.ok(receipt);
 const dummy=JSON.parse(Buffer.from(receipt,"base64").toString());
 assert.equal(dummy.transaction,"0x"+"22".repeat(32));
});
test("LOCAL MOCK ONLY: wrong marker cannot generate paid asset",async()=>{
 const r=await gen();const quote=JSON.parse(Buffer.from(r.headers.get("payment-required"),"base64").toString());
 const pay=Buffer.from(JSON.stringify({
   x402Version:2,resource:quote.resource,accepted:quote.accepts[0],extensions:quote.extensions||{},
   payload:{signature:"0x"+"12".repeat(65),authorization:{
    from:"0x"+"33".repeat(20),to:quote.accepts[0].payTo,
    value:quote.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
   }}
 })).toString("base64");
 const result=await gen("",{"PAYMENT-SIGNATURE":pay});
 assert.notEqual(result.status,200);
});
test("OpenAPI discovery transparently lists original generator and real license, no revenue claim",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const op=d.spec.paths["/v1/generate-lowpoly"].get;
 assert.equal(op["x-payment-info"].price.amount,"0.05");
 assert.ok(d.wellKnown.resources.some(x=>x.endsWith("/v1/generate-lowpoly")));
 assert.equal(d.spec.paths["/v1/lowpoly-sample"].get.security.length,0);
});
