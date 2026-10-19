import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const BASE=process.env.TEST_URL||"http://127.0.0.1:8736";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../public/lumen-garden");
const options={redirect:"manual"};

test("Free original responsive Lumen Garden is an unauthenticated zero-payment HTML5 game",async()=>{
 for(const [resource,type] of [["","text/html"],["game.js","javascript"],["style.css","text/css"],["favicon.svg","image/svg+xml"]]){
  const r=await fetch(BASE+"/games/lumen-garden/"+resource,options);
  assert.equal(r.status,200,resource);
  assert.equal(r.headers.get("payment-required"),null);
  assert.equal(r.headers.get("payment-response"),null);
  assert.ok(r.headers.get("content-type").includes(type),resource);
  assert.equal(r.headers.get("x-frame-options"),null);
  assert.match(r.headers.get("content-security-policy"),/connect-src 'none'/);
  assert.match(r.headers.get("content-security-policy"),/frame-ancestors \*/);
  const name=resource||"index.html";
  const local=fs.readFileSync(path.join(ROOT,name),"utf8");
  assert.equal(await r.text(),local);
 }
});
test("Free game cannot expose files outside its directory and does not weaken paid service security",async()=>{
 for(const name of ["nonexistent","../../../accounts/accounts.json",".git/config"]){
  const r=await fetch(BASE+"/games/lumen-garden/"+name,options);
  assert.notEqual(r.status,200,name);
  assert.equal(r.headers.get("payment-required"),null);
 }
 const paid=await fetch(BASE+"/v1/base-usdc-receipt?invalid=true",options);
 assert.equal(paid.status,400);
 assert.equal(paid.headers.get("x-frame-options"),"DENY");
 const tpl=await fetch(BASE+"/v1/x402-template",options);
 assert.equal(tpl.status,402);
 assert.equal(tpl.headers.get("x-frame-options"),"DENY");
});
