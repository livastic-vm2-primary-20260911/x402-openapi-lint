import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseGlbBase64, MAX_GLB_BYTES } from "../glb-analyzer.mjs";

function buildGlb(doc, bin=Buffer.alloc(36)) {
  const json=Buffer.from(JSON.stringify(doc));
  const jp=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const bp=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
  const total=12+8+jp.length+8+bp.length;
  const out=Buffer.alloc(12);
  out.write("glTF",0,"ascii");out.writeUInt32LE(2,4);out.writeUInt32LE(total,8);
  const h1=Buffer.alloc(8);h1.writeUInt32LE(jp.length,0);h1.writeUInt32LE(0x4E4F534A,4);
  const h2=Buffer.alloc(8);h2.writeUInt32LE(bp.length,0);h2.writeUInt32LE(0x004E4942,4);
  return Buffer.concat([out,h1,jp,h2,bp]);
}
function fixture() {
  return {
    asset:{version:"2.0"},
    buffers:[{byteLength:36}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:36}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3",
                min:[-1,0,-1],max:[1,1,1]}],
    materials:[{name:"green"}],
    meshes:[{primitives:[{attributes:{POSITION:0},material:0,mode:4}]}],
    nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0
  };
}
const analyze = d => parseGlbBase64(buildGlb(d).toString("base64"));
test("Valid original synthetic GLB: accurate geometry and local bounds",()=>{
  const x=analyze(fixture());
  assert.equal(x.ok,true);
  assert.equal(x.triangleCount,1);
  assert.equal(x.positionVertices,3);
  assert.equal(x.materialCount,1);
  assert.deepEqual(x.dimensions.span,[2,1,2]);
  assert.equal(x.warnings.length,0);
});
test("source bytes cap and invalid base64 are strict",()=>{
  assert.equal(parseGlbBase64(null).ok,false);
  assert.equal(parseGlbBase64("not-a-base64!").ok,false);
  assert.equal(parseGlbBase64("A".repeat(MAX_GLB_BYTES*2)).ok,false);
});
test("Reject GLB with wrong magic, version or header length",()=>{
  for(const how of ["magic","version","length"]){
    const b=buildGlb(fixture());
    if(how==="magic")b.write("DATA",0);
    if(how==="version")b.writeUInt32LE(1,4);
    if(how==="length")b.writeUInt32LE(2,8);
    assert.equal(parseGlbBase64(b.toString("base64")).ok,false,how);
  }
});
test("Never fetch external model buffers or image URIs",()=>{
  let d=fixture();
  d.buffers[0].uri="https://example.invalid/model.bin";
  assert.equal(analyze(d).ok,false);
  d=fixture();
  d.images=[{uri:"https://example.invalid/texture.png"}];
  assert.equal(analyze(d).ok,false);
});
test("Reject corrupted BIN lengths and invalid views/accessors",()=>{
  let d=fixture();d.buffers[0].byteLength=40;
  assert.equal(analyze(d).ok,false);
  d=fixture();d.bufferViews[0].byteLength=40;
  assert.equal(analyze(d).ok,false);
  d=fixture();d.accessors[0].count=4;
  assert.equal(analyze(d).ok,false);
});
test("Reject accessors with unsupported sparse payload and index reference",()=>{
  let d=fixture();d.accessors[0].sparse={count:3};
  assert.equal(analyze(d).ok,false);
  d=fixture();d.meshes[0].primitives[0].indices=23;
  assert.equal(analyze(d).ok,false);
});
test("Reject malformed triangle count and invalid bounds",()=>{
  let d=fixture();d.accessors[0].count=2;
  assert.equal(analyze(d).ok,false);
  d=fixture();d.accessors[0].min=[3,0,0];
  assert.equal(analyze(d).ok,false);
});
test("Empty/no meshes report warning, never claim paid work",()=>{
  const d=fixture();d.meshes=[];
  const r=analyze(d);
  assert.equal(r.ok,true);
  assert.equal(r.triangleCount,0);
  assert.ok(r.warnings.some(x=>x.includes("No triangle")));
  assert.equal("chargedUSDC" in r,false);
});
test("Reject maliciously huge mesh geometry counts without parsing triangles",()=>{
  const d=fixture();d.accessors[0].count=1_000_001;
  assert.equal(analyze(d).ok,false);
});
test("Natively generated original private 3D GLB samples parse if present (no private assets committed)",()=>{
  const base=path.resolve("..","vm5-original-lowpoly-prop-prototype-20261019","prototype_not_delivered");
  for(const [name,expect] of [["original_forest_lantern",380],["original_moss_marker",228]]){
    const file=path.join(base,name+".glb");
    if(!fs.existsSync(file))continue;
    const result=parseGlbBase64(fs.readFileSync(file).toString("base64"));
    assert.equal(result.ok,true,name+": "+result.error);
    assert.equal(result.triangleCount,expect);
    assert.equal(result.warnings.length,0);
  }
});
