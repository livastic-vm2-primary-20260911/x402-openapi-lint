import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import {parseAndGuardSpec,lintSpec,REDOCLY_VERSION,LIMIT_BYTES} from "./validator.mjs";
import {makeDiscovery} from "./discovery.mjs";

const DIR=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PORT||8736);
const BIND_HOST=process.env.HOST||"127.0.0.1";
if(!["127.0.0.1","0.0.0.0"].includes(BIND_HOST))throw Error("HOST must be 127.0.0.1 or 0.0.0.0");
const FACILITATOR_URL=process.env.FACILITATOR_URL||"https://facilitator.openx402.ai";
const PAY_TO=process.env.PAY_TO||"0x6b01efA0705E91a7aca54271510bf9e594717f34";
const PRICE="$0.01";
const NETWORK="eip155:8453";
if(!/^0x[0-9a-fA-F]{40}$/.test(PAY_TO))throw Error("PAY_TO must be a valid 20-byte Base recipient.");
if(!FACILITATOR_URL.startsWith("https://") && !(process.env.NODE_ENV==="test" && /^http:\/\/127\.0\.0\.1:\d+$/.test(FACILITATOR_URL)))throw Error("Facilitator must be HTTPS in production.");
if(!Number.isSafeInteger(PORT)||PORT<1024||PORT>65535)throw Error("Invalid PORT");

const sample=fs.readFileSync(path.resolve(DIR,"examples/sample.yaml"),"utf8");
const sampleReport=await lintSpec(sample);
if(sampleReport.errors!==0)throw Error("Pinned server Redocly failed on known valid example");
if(sampleReport.warnings!==2)throw Error("Pinned example lint changed unexpectedly. Revalidate published product.");

const facilitator=new HTTPFacilitatorClient({url:FACILITATOR_URL});
const resourceServer=new x402ResourceServer(facilitator);
resourceServer.register("eip155:*",new ExactEvmScheme());
await resourceServer.initialize(); // Read facilitator /supported before accepting x402 challenges.

const documentation={
  name:"VM5 OpenAPI Lint",
  version:"0.1.0",
  status:"pilot — x402 settlement not yet exercised with a real payment",
  paid:{
    method:"POST",
    path:"/v1/lint",
    priceUSDC:"0.01",
    network:NETWORK,
    asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    recipient:PAY_TO,
    schema:{
      type:"object",
      required:["spec"],
      properties:{spec:{type:"string",description:"UTF-8 OpenAPI 3.0 or 3.1 YAML/JSON string, maximum 64,000 bytes"}}
    },
    payment:"x402 v2 EIP-3009 Base USDC signature",
    facilitator:FACILITATOR_URL
  },
  free:{
    "/health":"Basic readiness check, no payment",
    "/v1/sample":"Full example lint result from independently verified public sample",
    "/v1/docs":"JSON API and payment terms"
  },
  scope:"Redocly recommended schema/documentation lint, no external $ref, no runtime server access, not a security certification",
  privacy:"Submitted specs are held in memory/temp files only for request processing, deleted after each run; no telemetry or access logging in application code. Cloudflare and the facilitator are separate external services; avoid secrets and client data.",
  disclosure:"VM5 is an AI-assisted seller. We do not claim settled payments or buyer reviews before verifying receipts."
};
const routes={
  "POST /v1/lint":{
    accepts:{scheme:"exact",price:PRICE,network:NETWORK,payTo:PAY_TO},
    description:"Linter checks OpenAPI YAML/JSON using Redocly recommended rules; report includes rule IDs, locations, severity and counts. External refs disabled.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"POST",bodyType:"json",
      input:{spec:'openapi: 3.0.3\ninfo:\n  title: Example\n  version: 1.0\npaths:\n  /hello:\n    get:\n      operationId: hello\n      responses:\n        "200":\n          description: OK\n'},
      inputSchema:{type:"object",properties:{spec:{type:"string",description:"OpenAPI YAML/JSON (no external $ref)" }},required:["spec"]},
      output:{example:{valid:true,errors:0,warnings:1,lintVersion:REDOCLY_VERSION,findings:[{ruleId:"operation-4xx-response",severity:"warn",message:"Operation must have at least one 4XX response."}]}}
    })
  }
};
const payment=paymentMiddleware(routes,resourceServer,undefined,undefined,false);

const app=express();
// Cloudflare Quick Tunnel connects from local loopback and forwards the public
// HTTPS scheme. Trust only that local reverse proxy so x402 resource URLs use
// https:// instead of the internal tunnel http:// origin.
app.set("trust proxy", BIND_HOST==="0.0.0.0" ? 1 : "loopback"); // Render HTTPS reverse proxy, or VM5 loopback tunnel
app.disable("x-powered-by");
const traffic=new Map();
const MAX_REQUESTS_PER_MINUTE=90;
let pendingChecks=0;
app.use((req,res,next)=>{
  const raw=req.headers["cf-connecting-ip"];
  const who=typeof raw==="string" && /^[0-9a-fA-F:.]{2,45}$/.test(raw)?raw:req.ip;
  const now=Date.now();
  const state=traffic.get(who);
  const item=!state||now-state.started>60000?{started:now,count:0}:state;
  item.count++;
  traffic.set(who,item);
  if(traffic.size>10000)for(const [id,s] of traffic)if(now-s.started>60000)traffic.delete(id);
  if(item.count>MAX_REQUESTS_PER_MINUTE){
    res.setHeader("Retry-After","60");
    return res.status(429).json({ok:false,charged:false,error:"Too many requests, retry later."});
  }
  next();
});
app.use((_req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,PAYMENT-SIGNATURE,PAYMENT-RESPONSE");
  res.setHeader("Access-Control-Expose-Headers","PAYMENT-REQUIRED,PAYMENT-RESPONSE");
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("X-Frame-Options","DENY");
  res.setHeader("Referrer-Policy","no-referrer");
  next();
});
app.get("/",(_req,res)=>res.redirect(302,"/v1/docs"));
app.get("/.well-known/402index-verify.txt",(_req,res)=>{
  const hash=fs.readFileSync(path.resolve(DIR,"verification/402index-verify.txt"),"utf8").trim();
  if(!/^[0-9a-f]{64}$/.test(hash))return res.status(503).type("text/plain").send("verification file invalid");
  return res.type("text/plain").send(hash);
});
app.get("/health",(_req,res)=>res.json({ok:true,service:"vm5-openapi-x402",network:NETWORK,paidRoute:"POST /v1/lint",sampleRedoclyErrors:sampleReport.errors}));
app.get("/v1/docs",(_req,res)=>res.json(documentation));
app.get("/v1/sample",(_req,res)=>res.json({kind:"public_sample",sampleTitle:"Independently authored JSONPlaceholder OpenAPI 3.0 spec",...sampleReport,paid:false,source:"https://github.com/livastic-vm5-primary-20260911/vm5-delivery-lab/tree/main/examples"}));
app.get("/openapi.json",(req,res)=>{
  try{const origin=req.protocol+"://"+req.get("host");res.json(makeDiscovery(origin).spec);}
  catch{return res.status(503).json({error:"Discovery host not available."});}
});
app.get(["/.well-known/x402","/.well-known/x402.json"],(req,res)=>{
  try{const origin=req.protocol+"://"+req.get("host");res.json(makeDiscovery(origin).wellKnown);}
  catch{return res.status(503).json({error:"Discovery host not available."});}
});

app.options("/v1/lint",(_req,res)=>res.status(204).end());

app.post("/v1/lint",express.json({limit:"85kb",type:["application/json","application/*+json"]}),(req,res,next)=>{
  if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({error:"Use application/json with {spec: OpenAPI YAML/JSON string}."});
  if(req.body===null||typeof req.body!=="object"||Array.isArray(req.body))return res.status(400).json({error:"Provide a JSON object with a spec field."});
  if(!Object.prototype.hasOwnProperty.call(req.body,"spec"))return res.status(400).json({error:"Missing required spec field."});
  const input=parseAndGuardSpec(req.body.spec);
  if(!input.ok)return res.status(400).json({error:input.error,charged:false});
  if(pendingChecks>=2)return res.status(503).json({ok:false,charged:false,error:"Server busy. Retry later, no payment accepted."});
  pendingChecks++;
  res.on("finish",()=>{pendingChecks=Math.max(0,pendingChecks-1);});
  res.locals.safeSpec=input.spec;
  res.locals.stats=input.stats;
  next();
},payment,async(req,res)=>{
  try{
    const lint=await lintSpec(res.locals.safeSpec);
    return res.status(200).json({ok:true,chargedUSDC:"0.01",network:NETWORK,redocly:lint,limits:res.locals.stats,guarantee:"Findings based on Redocly 2.64.1 recommended lint. This is not runtime API testing or security assessment."});
  }catch{
    // Avoid returning secrets, internal filesystem paths or misleading success.
    return res.status(503).json({ok:false,error:"Validator temporarily unavailable. No customer specification or secret material was logged."});
  }
});
app.use((err,_req,res,_next)=>{
  if(res.headersSent)return;
  const body={ok:false,charged:false,error:err?.type==="entity.too.large"?"Request exceeds 85kb JSON body limit.":"Invalid JSON envelope."};
  res.status(err?.type==="entity.too.large"?413:400).json(body);
});
const server=app.listen(PORT,BIND_HOST,()=>console.log("VM5 x402 OpenAPI lint service listening on "+BIND_HOST+":"+PORT+" for Base USDC; actual payment untested."));
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
