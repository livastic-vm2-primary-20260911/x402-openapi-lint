import test from "node:test";
import assert from "node:assert/strict";
import {makeDiscovery} from "../discovery.mjs";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";

function originalTinyGLB({external=false}={}) {
 const float = new Float32Array([0,0,0, 1,0,0, 0,1,0]);
 const binary=Buffer.from(float.buffer);
 const doc={
  asset:{version:"2.0",generator:"original VM5 paid-geometry-test-fixture"},
  buffers:[{byteLength:binary.length,...(external?{uri:"https://evil.invalid/gltf.bin"}:{})}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:binary.length}],
  accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3",
    min:[0,0,0],max:[1,1,0]}],
  materials:[{name:"procedural_flat_colour"}],
  meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
  nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0
 };
 const json=Buffer.from(JSON.stringify(doc));
 const jp=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const total=12+8+jp.length+8+binary.length;
 const head=Buffer.alloc(12);head.write("glTF");head.writeUInt32LE(2,4);head.writeUInt32LE(total,8);
 const jc=Buffer.alloc(8);jc.writeUInt32LE(jp.length,0);jc.writeUInt32LE(0x4E4F534A,4);
 const bc=Buffer.alloc(8);bc.writeUInt32LE(binary.length,0);bc.writeUInt32LE(0x004E4942,4);
 return Buffer.concat([head,jc,jp,bc,binary]).toString("base64");
}
const request=(body,headers={})=>fetch(BASE+"/v1/analyze-glb",{
 method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)
});

test("Free GLB portfolio proof endpoint claims no customer payment",async()=>{
 const r=await fetch(BASE+"/v1/glb-sample");
 assert.equal(r.status,200);
 const x=await r.json();assert.equal(x.paid,false);
 assert.ok(x.examples.some(e=>e.triangleCount===380));
 assert.ok(x.examples.some(e=>e.triangleCount===228));
 assert.equal(r.headers.get("payment-required"),null);
});
test("Strict input validation before charge rejects empty, extra keys and remote model dependencies",async()=>{
 for(const body of [null,{}, {glbBase64:"!!!"}, {glbBase64:originalTinyGLB(),url:"https://evil.invalid"}, {glbBase64:originalTinyGLB({external:true})}]){
  const r=await request(body);
  assert.equal(r.status,400,JSON.stringify(body)?.slice(0,60));
  assert.equal((await r.json()).charged,false);
  assert.equal(r.headers.get("payment-required"),null);
 }
});
test("One valid GLB triggers genuine-format x402 Base USDC payment requirement before metadata",async()=>{
 const r=await request({glbBase64:originalTinyGLB()});
 assert.equal(r.status,402);
 const h=r.headers.get("payment-required");
 assert.ok(h);
 const quote=JSON.parse(Buffer.from(h,"base64").toString("utf8"));
 assert.equal(quote.x402Version,2);
 assert.equal(quote.accepts.length,1);
 assert.equal(quote.accepts[0].amount,"10000");
 assert.equal(quote.accepts[0].network,"eip155:8453");
 assert.equal(quote.accepts[0].asset.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(quote.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
});
test("LOCALHOST MOCK ONLY: fake facilitator accepts known marker then returns protected exact GLB audit",async()=>{
 const body={glbBase64:originalTinyGLB()};
 const before=await request(body);assert.equal(before.status,402);
 const quote=JSON.parse(Buffer.from(before.headers.get("payment-required"),"base64").toString("utf8"));
 const marker="0x"+"11".repeat(65);
 const payload={
  x402Version:2,resource:quote.resource,accepted:quote.accepts[0],
  payload:{signature:marker,authorization:{
   from:"0x"+"33".repeat(20),to:quote.accepts[0].payTo,
   value:quote.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
  }},extensions:quote.extensions||{}
 };
 const payment=Buffer.from(JSON.stringify(payload)).toString("base64");
 const paid=await request(body,{"PAYMENT-SIGNATURE":payment});
 assert.equal(paid.status,200);
 const x=await paid.json();
 assert.equal(x.ok,true);assert.equal(x.paid,true);
 assert.equal(x.kind,"glb_v2_geometry_audit");
 assert.equal(x.chargedUSDC,"0.01");
 assert.equal(x.triangleCount,1);
 assert.equal(x.positionVertices,3);
 assert.equal(x.meshCount,1);assert.equal(x.materialCount,1);
 assert.deepEqual(x.dimensions.span,[1,1,0]);
 assert.equal(JSON.stringify(x).includes(body.glbBase64),false);
 const paidReceipt=paid.headers.get("payment-response");assert.ok(paidReceipt);
 const dec=JSON.parse(Buffer.from(paidReceipt,"base64").toString());
 assert.equal(dec.transaction,"0x"+"22".repeat(32));
});
test("Payment marker mismatch NEVER unlocks assets or JSON result",async()=>{
 const body={glbBase64:originalTinyGLB()};
 const before=await request(body);const q=JSON.parse(Buffer.from(before.headers.get("payment-required"),"base64").toString());
 const h=Buffer.from(JSON.stringify({
  x402Version:2,resource:q.resource,accepted:q.accepts[0],
  payload:{signature:"0x"+"12".repeat(65),authorization:{
   from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,
   value:q.accepts[0].amount,validAfter:"0",validBefore:"9999999999",nonce:"0x"+"44".repeat(32)
  }},extensions:q.extensions||{}
 })).toString("base64");
 const result=await request(body,{"PAYMENT-SIGNATURE":h});
 assert.notEqual(result.status,200);
});
test("Standard OpenAPI and well-known discovery include one unchanged-price paid GLB route",()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const op=d.spec.paths["/v1/analyze-glb"]?.post;
 assert.ok(op);
 assert.equal(op["x-payment-info"].price.amount,"0.01");
 assert.ok(op.responses["200"]);assert.ok(op.responses["402"]);
 assert.ok(d.wellKnown.resources.includes("https://vm5-openapi-x402.onrender.com/v1/analyze-glb"));
});
test("OpenAPI GLB inspector POST sample is fully valid and passes the paywall preflight",async()=>{
 const d=makeDiscovery("https://vm5-openapi-x402.onrender.com");
 const example=d.spec.paths["/v1/analyze-glb"].post.requestBody.content["application/json"].example;
 assert.ok(example && typeof example.glbBase64==="string");
 const r=await request(example);
 assert.equal(r.status,402);
 assert.ok(r.headers.get("PAYMENT-REQUIRED"));
 assert.equal(Buffer.from(example.glbBase64,"base64").toString("ascii",0,4),"glTF");
});
