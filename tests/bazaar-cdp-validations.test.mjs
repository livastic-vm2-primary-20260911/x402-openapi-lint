import test from "node:test";
import assert from "node:assert/strict";
const BASE=process.env.TEST_URL || "http://127.0.0.1:8736";
const getQuote=async (path)=>{
 const r=await fetch(BASE+path);
 assert.equal(r.status,402,"Valid unpaired GET must challenge");
 const enc=r.headers.get("PAYMENT-REQUIRED");
 assert.ok(enc);
 const raw=JSON.parse(Buffer.from(enc,"base64").toString("utf8"));
 assert.equal(raw.x402Version,2);
 assert.equal(raw.accepts.length,1);
 assert.equal(raw.accepts[0].network,"eip155:8453");
 assert.equal(raw.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 const bazaar=raw.extensions?.bazaar;
 assert.ok(bazaar,"Required Bazaar 402 extension must be present");
 assert.equal(bazaar.info?.input?.type,"http");
 assert.equal(bazaar.info?.input?.method,"GET");
 assert.equal(bazaar.info?.output?.type,"json");
 assert.ok(typeof bazaar.info?.output?.example==="object");
 assert.ok(bazaar.schema?.properties?.input);
 return {raw,bazaar,r};
};
test("CDP Bazaar prereq: GET x402 template declares exact HTTP inputs, JSON output for real independent buyer", async()=>{
 const {raw,bazaar}=await getQuote("/v1/x402-template");
 assert.equal(raw.accepts[0].amount,"10000");
 const o=bazaar.info.output.example;
 assert.equal(o.kind,"x402_v2_openapi_starter");
 assert.equal(o.chargedUSDC,"0.01");
 assert.equal(o.redocly.errors,0);
 assert.equal(o.redocly.warnings,0);
 assert.equal(o.templateFormat,"YAML");
 assert.equal(o.paid,true);
});
test("CDP Bazaar prereq: lowpoly GET has correct output semantics, deterministic default",async()=>{
 const {raw,bazaar}=await getQuote("/v1/generate-lowpoly");
 assert.equal(raw.accepts[0].amount,"50000");
 assert.equal(bazaar.info.output.example.kind,"lantern");
 assert.equal(bazaar.info.output.example.seed,0);
 assert.equal(bazaar.info.output.example.paid,true);
 assert.equal(bazaar.info.output.example.fileName,"lastone_lantern_0.glb");
});
test("Unexpected template URL query rejected before any payment, declared no-input GET remains valid",async()=>{
 const r=await fetch(BASE+"/v1/x402-template?format=yaml");
 assert.equal(r.status,400);
 assert.equal(r.headers.get("PAYMENT-REQUIRED"),null);
 const {raw,bazaar}=await getQuote("/v1/x402-template");
 assert.equal(raw.accepts[0].amount,"10000");
 assert.ok(bazaar.info?.output?.example);
});
