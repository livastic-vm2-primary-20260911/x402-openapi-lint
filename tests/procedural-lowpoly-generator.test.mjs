import test from "node:test";
import assert from "node:assert/strict";
import {generateOriginalGlb} from "../procedural-lowpoly-generator.mjs";
import {parseGlbBase64} from "../glb-analyzer.mjs";
const cases=[["lantern",0],["lantern",1],["lantern",124],["marker",0],["marker",1],["marker",999999]];
for(const [kind,seed] of cases){
 test("Procedural low-poly GLB is deterministic, valid and has no remote assets: "+kind+" "+seed,()=>{
  const a=generateOriginalGlb(kind,seed),b=generateOriginalGlb(kind,seed);
  assert.equal(a.sha256,b.sha256);assert.equal(a.glbBase64,b.glbBase64);
  assert.equal(a.kind,kind);assert.equal(a.seed,seed);
  assert.ok(a.bytes>3000&&a.bytes<1_500_000);
  const analysis=parseGlbBase64(a.glbBase64);
  assert.equal(analysis.ok,true,analysis.error);
  assert.equal(analysis.triangleCount,a.triangles);
  assert.ok(analysis.materialCount>2);
  assert.ok(analysis.dimensions.min[1]>=0);
  assert.ok(analysis.dimensions.max[1]>1);
  assert.equal(a.disclosure.includes("source is public"),true);
  assert.equal(a.licensing.includes("Non-exclusive"),true);
 });
}
test("Different procedural seeds actually produce distinct GLB binaries",()=>{
 const a=generateOriginalGlb("marker",0),b=generateOriginalGlb("marker",1);
 assert.notEqual(a.sha256,b.sha256);
});
test("Non-whitelisted procedural params and unsafely large seeds are rejected",()=>{
 for(const [kind,seed] of [["lion",1],["marker",-1],["marker",1e9],["lantern",1.1],["GLB",0],["marker","0"]])
  assert.throws(()=>generateOriginalGlb(kind,seed));
});
