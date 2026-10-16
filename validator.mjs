import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(DIR, "node_modules", "@redocly", "cli", "bin", "cli.js");
export const LIMIT_BYTES = 64000;
export const MAX_NODES = 18000;
export const MAX_DEPTH = 90;
export const REDOCLY_VERSION = "2.64.1";
const EMPTY = Object.freeze({});

export function parseAndGuardSpec(value) {
  if (typeof value !== "string" || !value.trim()) return { ok:false, error:"Provide a non-empty spec string containing OpenAPI YAML or JSON." };
  if (Buffer.byteLength(value, "utf8") > LIMIT_BYTES) return {ok:false,error:"Spec exceeds the 64,000-byte input limit."};
  let parsed;
  try{
    const doc = YAML.parseDocument(value, {strict:true,uniqueKeys:true,maxAliasCount:0});
    if(doc.errors.length) throw new Error(doc.errors[0].message);
    if(doc.warnings.length) throw new Error(doc.warnings[0].message);
    parsed=doc.toJS({maxAliasCount:0,mapAsMap:false});
  }catch(e){
    return {ok:false,error:"Invalid YAML/JSON: "+String(e.message || "malformed document").slice(0,160)};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {ok:false,error:"The OpenAPI document root must be an object."};
  let nodes=0,maxDepth=0,externalRefs=0;
  const stack=[{node:parsed,depth:0}];
  const visited=new Set();
  while(stack.length){
    const {node,depth}=stack.pop();
    if(depth>MAX_DEPTH)return {ok:false,error:"Document nesting exceeds the safe depth limit."};
    if(!node||typeof node!=="object")continue;
    if(visited.has(node))return {ok:false,error:"Cyclic YAML anchors/references are not supported."};
    visited.add(node);
    if(++nodes>MAX_NODES)return {ok:false,error:"Document exceeds the safe object/array-node limit."};
    maxDepth=Math.max(maxDepth,depth);
    if(Array.isArray(node)){for(const v of node)stack.push({node:v,depth:depth+1});continue}
    for(const [k,v] of Object.entries(node)){
      if(k==="$ref" && typeof v==="string" && !/^#(?:$|\/)/.test(v))externalRefs++;
      if(v!==null && typeof v==="object")stack.push({node:v,depth:depth+1});
    }
  }
  if(externalRefs)return {ok:false,error:"External $ref URLs and file paths are intentionally disabled. Inline local component references only."};
  return {ok:true,spec:value,stats:{bytes:Buffer.byteLength(value,"utf8"),nodes,maxDepth}};
}

export async function lintSpec(spec) {
  if(!fsSync.existsSync(CLI))throw Error("Pinned Redocly CLI is unavailable");
  let dir=await fs.mkdtemp(path.join(os.tmpdir(),"vm5-openapi-"));
  let file=path.join(dir,"submitted.yml");
  try {
    await fs.chmod(dir,0o700);
    await fs.writeFile(file,spec,{mode:0o600,flag:"wx"});
    return await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[CLI,"lint",file,"--format=json"],{
        cwd:dir,
        env:{PATH:process.env.PATH||"/usr/bin:/bin",HOME:dir,CI:"1",NO_UPDATE_NOTIFIER:"1"},
        shell:false,stdio:["ignore","pipe","pipe"],windowsHide:true
      });
      let out="",err="",done=false;
      const timer=setTimeout(()=>{child.kill("SIGKILL");},10000);
      child.stdout.on("data",d=>{out+=d.toString();if(out.length>250000)child.kill("SIGKILL");});
      child.stderr.on("data",d=>{err+=d.toString();if(err.length>20000)child.kill("SIGKILL");});
      child.on("error",e=>{clearTimeout(timer);reject(Error("Validator launch failed: "+e.message));});
      child.on("close",code=>{
        clearTimeout(timer);
        if(!out.startsWith("{"))return reject(Error("Validator did not produce a bounded JSON response."));
        let json;
        try{json=JSON.parse(out)}catch{return reject(Error("Validator returned invalid JSON."));}
        const totals=json.totals||EMPTY;
        const issues=(Array.isArray(json.problems)?json.problems:[]).slice(0,300).map(p=>({
          ruleId:p.ruleId||"unknown",
          severity:p.severity||"warn",
          message:String(p.message||"").slice(0,420),
          location:(p.location||[]).map(z=>({pointer:z.pointer||"#",line:z.start?.line||null,column:z.start?.col||null})).slice(0,4),
          suggestedFix:String(p.suggest||"").slice(0,350)||null
        }));
        resolve({lintVersion:json.version||REDOCLY_VERSION,valid:Number(totals.errors||0)===0,errors:Number(totals.errors||0),warnings:Number(totals.warnings||0),ignored:Number(totals.ignored||0),findings:issues,notes:["Recommended Redocly rules are advisory; zero errors is not a security certification.","Only this submitted OpenAPI document was processed. External $ref imports were disabled."],exitCode:code});
      });
    });
  }finally{
    await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
  }
}
