import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseAndGuardSpec,lintSpec,LIMIT_BYTES} from "../validator.mjs";

const example=fs.readFileSync(new URL("../examples/sample.yaml",import.meta.url),"utf8");
const base=process.env.TEST_URL || "http://127.0.0.1:8736";

test("known reference YAML accepted",()=>{
 const r=parseAndGuardSpec(example);
 assert.equal(r.ok,true);
 assert.ok(r.stats.bytes>1000);
});
test("JSON OpenAPI format accepted",()=>{
 assert.equal(parseAndGuardSpec('{"openapi":"3.0.3","info":{"title":"Test","version":"1"},"paths":{}}').ok,true);
});
test("invalid, empty and scalar documents rejected",()=>{
 for(const s of ["","  ","[1,2]","{not JSON : !!!","x: [broken"]){
   assert.equal(parseAndGuardSpec(s).ok,false);
 }
});
test("nonnumeric spec input rejected",()=>{
 for(const x of [null,123,{data:1},[],true])assert.equal(parseAndGuardSpec(x).ok,false);
});
test("nonlocal references are rejected",()=>{
 for(const ref of ["https://example.com/a.yaml","file:///etc/passwd","../internal.yaml","ipfs://bafyasdf"]){
   const s=["openapi: 3.0.3","info: {title: Demo, version: '1'}","components:","  schemas:","    A: {$ref: '"+ref+"'}","paths: {}"].join("\n");
   assert.equal(parseAndGuardSpec(s).ok,false,ref);
 }
});
test("local refs are permitted",()=>{
 const s=["openapi: 3.0.3","info: {title: Demo, version: '1'}","components:","  schemas:","    A: {$ref: '#/components/schemas/B'}","    B: {type: string}","paths: {}"].join("\n");
 assert.equal(parseAndGuardSpec(s).ok,true);
});
test("input byte cap applies",()=>assert.equal(parseAndGuardSpec("x".repeat(LIMIT_BYTES+1)).ok,false));
test("deeply nested document refused",()=>{
 const s=Array.from({length:95},(_,i)=>"  ".repeat(i)+"a:").join("\n")+"\n"+"  ".repeat(95)+"leaf: 1\n";
 assert.equal(parseAndGuardSpec(s).ok,false);
});
test("Redocly recommended lint reports known sample",async()=>{
 const d=await lintSpec(example);
 assert.equal(d.errors,0);
 assert.equal(d.warnings,2);
 assert.equal(d.lintVersion,"2.64.1");
 assert.ok(d.findings.every(x=>x.ruleId==="operation-4xx-response"));
});
test("Redocly lint finds an incomplete response definition",async()=>{
 const s=["openapi: 3.0.3","info: {title: Demo, version: '1'}","paths:","  /ok:","    get:","      responses:","        '200': {}"].join("\n");
 const d=await lintSpec(s);
 assert.ok(d.errors>=1);
 assert.equal(d.valid,false);
});
test("public sample preview needs no payment",async()=>{
 const r=await fetch(base+"/v1/sample");
 assert.equal(r.status,200);
 const o=await r.json();
 assert.equal(o.paid,false);
 assert.equal(o.warnings,2);
});
test("valid paid request without signature returns Base x402 v2 challenge",async()=>{
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:example})});
 assert.equal(r.status,402);
 const h=r.headers.get("payment-required");
 assert.ok(h);
 const o=JSON.parse(Buffer.from(h,"base64").toString());
 assert.equal(o.x402Version,2);
 assert.equal(o.accepts[0].network,"eip155:8453");
 assert.equal(o.accepts[0].amount,"20000");
 assert.equal(o.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 assert.equal(o.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
});
test("malformed spec never reaches payment wall",async()=>{
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:"openapi: [bad"})});
 assert.equal(r.status,400);
 assert.equal(r.headers.get("payment-required"),null);
 assert.equal((await r.json()).charged,false);
});
test("external reference never reaches payment wall",async()=>{
 const s=["openapi: '3.0.3'","components: {schemas: {A: {$ref: '../private.txt'}}}"].join("\n");
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:s})});
 assert.equal(r.status,400);
 assert.equal((await r.json()).charged,false);
});
test("invalid JSON envelope is unpaid 400",async()=>{
 const r=await fetch(base+"/v1/lint",{method:"POST",headers:{"Content-Type":"application/json"},body:"{invalid"});
 assert.equal(r.status,400);
 assert.equal(r.headers.get("payment-required"),null);
});

test("Machine-discoverable OpenAPI metadata exposes one paid POST and accurate 402 schema",async()=>{
 const r=await fetch(base+"/openapi.json");
 assert.equal(r.status,200);
 const spec=await r.json();
 assert.equal(spec.openapi,"3.1.0");
 const op=spec.paths["/v1/lint"].post;
 assert.ok(op);
 assert.equal(op["x-payment-info"].protocols[0],"x402");
 assert.equal(op["x-payment-info"].price.amount,"0.02");
 assert.ok(op.responses["402"]);
 assert.ok(op.requestBody.content["application/json"].example.spec);
 assert.equal(spec.paths["/v1/sample"].get.security.length,0);
 assert.ok(spec.components.securitySchemes.x402Payment);
 assert.ok(!JSON.stringify(spec).includes("onecursora1@gmail.com"));
});
test("Well-known x402 document points at current lint POST route",async()=>{
 for(const path of ["/.well-known/x402","/.well-known/x402.json"]){
  const r=await fetch(base+path);
  assert.equal(r.status,200);
  const manifest=await r.json();
  assert.equal(manifest.version,1);
  assert.ok(manifest.resources.some(s=>s.endsWith("/v1/lint")));
  assert.equal(manifest.resources.length,1);
 }
});
