import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paymentMiddleware } from "@x402/express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import {parseAndGuardSpec,lintSpec,REDOCLY_VERSION,LIMIT_BYTES} from "./validator.mjs";
import {makeDiscovery} from "./discovery.mjs";
import {validateReceiptQuery,preflightBaseUSDCReceipt} from "./base-usdc-receipt.mjs";
import {parseGlbBase64, MAX_GLB_BYTES} from "./glb-analyzer.mjs";
import {generateOriginalGlb} from "./procedural-lowpoly-generator.mjs";
import {inspectCsv,validateCsvInput,DEMO_CSV,CSV_LIMITS} from "./csv-preflight.mjs";
import {parsePublicQuote,evaluatePublicQuote,EXAMPLE_QUOTE,VERSION as VM3_QUOTE_VERSION} from "./quote-preflight.mjs";
import {validatePublicDomain,auditEmailDns} from "./email-dns-preflight.mjs";

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

const demoCsvReport=inspectCsv({csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]});
if(!demoCsvReport.ok || demoCsvReport.normalizedDuplicateRows!==1 ||
   demoCsvReport.spreadsheetFormulaRiskCells!==1 ||
   demoCsvReport.irregularRows!==1)throw Error("Original synthetic CSV business-value sample changed unexpectedly");
const sample=fs.readFileSync(path.resolve(DIR,"examples/sample.yaml"),"utf8");
const sampleReport=await lintSpec(sample);
if(sampleReport.errors!==0)throw Error("Pinned server Redocly failed on known valid example");
if(sampleReport.warnings!==2)throw Error("Pinned example lint changed unexpectedly. Revalidate published product.");
// Original local OpenAPI x402 v2 reference, offered as a paid machine-readable starter.
const paymentTemplate=fs.readFileSync(path.resolve(DIR,"examples/x402-payment-template.yaml"),"utf8");
const paymentTemplateReport=await lintSpec(paymentTemplate);
if(paymentTemplateReport.errors!==0 || paymentTemplateReport.warnings!==0)throw Error("x402 template lint baseline changed. Refuse to serve an invalid reference.");

const facilitator=new HTTPFacilitatorClient({url:FACILITATOR_URL});
const resourceServer=new x402ResourceServer(facilitator);
resourceServer.register("eip155:*",new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);
await resourceServer.initialize(); // Read facilitator /supported before accepting x402 challenges.

const documentation={
  name:"VM5 OpenAPI Lint",
  version:"0.1.0",
  status:"LIVE — two genuine distinct paid-and-delivered x402 calls from the SAME independent NoHumans automated scout: template 0.010000 native Base USDC, CSV report 0.005000 native Base USDC; combined 0.015000 token received. No organic repeat human buyer or fiat cashout proven.",
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
  paidReceipt:{
    method:"GET",path:"/v1/base-usdc-receipt",
    priceUSDC:"0.005",network:NETWORK,
    query:{
      tx:"0x-prefixed 32-byte Base transaction hash",
      recipient:"0x-prefixed 20-byte Base wallet address",
      minUsdc:"positive decimal up to 6 fractional places",
      sender:"optional expected external USDC transfer-from address"
    },
    purpose:"Read-only Circle native Base USDC receipt proof with 12-block confirmation gate, net token Transfer logs, strict optional sender, exact integer decimals.",
    caveat:"Successful Transfer log is not invoice settlement, buyer intent, a security audit or proof of account ownership. Invalid/failed/unconfirmed receipts are rejected BEFORE payment."
  },
  paidCsv:{method:"POST",path:"/v1/csv-preflight",priceUSDC:"0.005",network:NETWORK,
    purpose:"RFC4180-style CSV structural preflight for real buyer CSV bytes. Returns row/column counts, duplicate rows, type mismatches, missing cells and formula injection warnings; never echoes raw row cells or persists uploaded CSV.",
    schema:{csvText:"UTF8 CSV <=32kb",expectedColumns:"optional nonempty column-name array <=40"},
    limitations:"Not full spreadsheet compliance, data truth, threat scanning or GDPR certification; do not submit secrets, infrastructure/settlement log separately."},
  paidCsvDemo:{method:"GET",path:"/v1/csv-report",priceUSDC:"0.005",network:NETWORK,
    purpose:"Deliver a full machine-readable integrity report of an original synthetic test CSV. No customer data, request inputs or special query; pays for structured ready-to-consume report, which can also be computed from disclosed public sample."},
  paidEmailDns:{method:"GET",path:"/v1/email-dns-preflight",priceUSDC:"0.005",network:NETWORK,
    purpose:"Public domain MX/SPF/DMARC DNS configuration preflight with read-only bounded lookups. No email addresses, SMTP, mailbox deliverability promise, DKIM selectors or security certification.",
    input:"Optional public domain, default gmail.com. Preflight DNS health checked before an x402 quote; failed DNS lookup is not billed.",
    freePreview:"GET /v1/email-dns-sample",confirmedIndependentCustomers:0},
  paidQuote:{method:"GET",path:"/v1/x402-preflight",priceUSDC:"0.01",network:NETWORK,
    purpose:"Offline-only public unsigned x402 v2 HTTP402 quote consistency review, adapted from original same-owner VM3 source. No live network fetch, merchant identity certification, wallet spend or settlement proof.",
    input:"One optional quote JSON or Base64 in query, max 12000 characters; omitted means a fake original public fixture",
    source:"Same-beneficial-owner original VM3, MIT author source, hosted by original VM5 native Base Circle USDC seller",freePreview:"GET /v1/x402-sample"},
  paidLowpoly:{method:"GET",path:"/v1/generate-lowpoly",priceUSDC:"0.05",network:NETWORK,
    purpose:"Deliver reproducible AI-assisted original procedural GLB 2.0 forest lantern or stone marker as Base64 binary with seed and SHA256. This is an as-is non-exclusive convenience service, not exclusive IP or a paid client commission.",
    sample:"GET /v1/lowpoly-sample is free. GET /v1/generate-lowpoly defaults to kind=lantern and seed=0; optional kind=marker and integer seed 0..999999.",
    licence:"Source generator is public; purchase is hosted generation and output delivery only. Rights are as-is, limited to those legally held and licensable by VM5."},
  paidGlb:{method:"POST",path:"/v1/analyze-glb",priceUSDC:"0.01",network:NETWORK,
    purpose:"In-memory non-executing GLB 2 model inspection, geometry/triangles/materials/local bounds, <=1.5MB. No remote fetch, files retained or source distribution.",
    caution:"This is a paid descriptive model metadata review, not a security, copyright or full glTF compliance certification. A developer may need original engine-level tests."},
  paidTemplate:{
    method:"GET",path:"/v1/x402-template",priceUSDC:"0.01",network:NETWORK,
    purpose:"Get a ready-to-adapt, independently authored x402 v2 OpenAPI 3.0.3 template and Redocly validation report; no customer spec submitted.",
    payment:"Exact x402 v2 Base USDC through the same verified payment middleware",
    caveat:"Reference design only. Replace example.invalid URLs and provide your own secure payment verification/settlement implementation."
  },
  free:{
    "/health":"Basic readiness check, no payment",
    "/v1/sample":"Full example lint result from independently verified public sample",
    "/v1/docs":"JSON API and payment terms"
  },
  scope:"Redocly recommended schema/documentation lint, no external $ref, no runtime server access, not a security certification",
  privacy:"Submitted specs are held in memory/temp files only for request processing, deleted after each run; no telemetry or access logging in application code. Cloudflare and the facilitator are separate external services; avoid secrets and client data.",
  disclosure:"VM5 AI-assisted one-owner API. Two distinct paid delivered API calls 0.01 template and 0.005 CSV report by SAME independent NoHumans auto scout, not two organic buyers or recurring demand. Other route sales unverified except the explicitly proven CSV demo. No owner fiat cashout or net profit established.",
  firstVerifiedIndependentPaidSale:{endpoint:"GET /v1/x402-template",amountNativeBaseCircleUSDC:"0.01",distinctDeliveredPurchases:1,fiatCashoutUSD:"0",onchain:"https://basescan.org/tx/0x5ced9d7d47a864b62afd408d785e0cf7a6b0cc862a6940630ee9283ce18be912",officialIndependentProof:"https://nohumans.directory/l/7fb76f81-0b5"},
  secondVerifiedIndependentPaidSale:{endpoint:"GET /v1/csv-report",amountNativeBaseCircleUSDC:"0.005",distinctDeliveredPurchases:1,fiatCashoutUSD:"0",onchain:"https://basescan.org/tx/0xc0c69aa8709b848ab3c0d521ac6540e019738f0804565dfe19652bcb3c290838",officialIndependentProof:"https://nohumans.directory/l/816d6709-3d0"},
  allVerifiedDistinctPaidApiCalls:2,
  totalActuallyReceivedNativeBaseCircleUSDC:"0.015",
  uniqueExternalScoutBuyerWallets:1
};
const routes={
  "GET /v1/csv-report":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Original demonstration CSV integrity report (duplicate normalized rows, invalid email/number/date, formula injection warning, inconsistent row width). Source CSV and code are public/reproducible; purchase is hosted report convenience, not exclusive IP or customer history.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",kind:"csv_structure_quality_preflight",
        reportVersion:"1.0",headerColumns:4,dataRows:5,irregularRows:1,
        normalizedDuplicateRows:1,spreadsheetFormulaRiskCells:1,
        noRawDataReturned:true}}
    })
  },
  "POST /v1/csv-preflight":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Customer-supplied <=32KB CSV structural quality preflight; parsed before payment without storage, does not echo raw CSV cells, reports invalid values only by row/column coordinate. No safety/compliance certification.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"POST",bodyType:"json",
      input:{csvText:DEMO_CSV,expectedColumns:["email","amount","date","note"]},
      inputSchema:{type:"object",additionalProperties:false,required:["csvText"],
        properties:{csvText:{type:"string",maxLength:32768},expectedColumns:{type:"array",items:{type:"string"},maxItems:40}}},
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",kind:"csv_structure_quality_preflight",dataRows:5,irregularRows:1,normalizedDuplicateRows:1,spreadsheetFormulaRiskCells:1}}
    })
  },
  "GET /v1/email-dns-preflight":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"One bounded public MX/SPF/DMARC and A DNS configuration report. Optional domain query, defaults to gmail.com. No mailbox, SMTP, DKIM selector or inbox deliverability verification. Rejected invalid/unresolvable inputs not charged.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.005",kind:"public_email_dns_preflight",domain:"gmail.com",mxCount:5,spfPresent:true,dmarcPresent:true,rawEmailAddressesReceived:false,smtpContactAttempted:false}}
    })
  },
  "GET /v1/x402-preflight":{
    accepts:{scheme:"exact",price:"$0.01",network:NETWORK,payTo:PAY_TO},
    description:"Original VM3 protocol-only public x402 v2 402 quote syntax review hosted by VM5; optional buyer supplied unsigned public quote, or no-input fictional example. Not a merchant safety, ownership, actual settlement, or identity certification.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{ok:true,paid:true,chargedUSDC:"0.01",
        version:VM3_QUOTE_VERSION,kind:"x402_v2_public_402_offline_quote_review",
        paymentNetwork:NETWORK,checkCount:8,failedChecks:0,unknownChecks:0,
        reviewOutcome:"basic_public_structure_consistent",noSignedPaymentDataStored:true,noSpendingAuthorized:true}}
    })
  },
  "GET /v1/generate-lowpoly":{
    accepts:{scheme:"exact",price:"$0.05",network:NETWORK,payTo:PAY_TO},
    description:"Generate original AI-assisted procedural low-poly GLB 2.0 bytes by public-source algorithm for 0.05 native Circle Base USDC. Default lantern, seed 0. Non-exclusive as-is convenience; no exclusive asset copyright or engine certification.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{
        ok:true,paid:true,chargedUSDC:"0.05",network:NETWORK,
        kind:"lantern",seed:0,fileName:"lastone_lantern_0.glb",
        triangles:284,materials:8,format:"GLB 2.0"
      }}
    })
  },
  "POST /v1/analyze-glb":{
    accepts:{scheme:"exact",price:PRICE,network:NETWORK,payTo:PAY_TO},
    description:"Audit one original or client-provided glTF 2.0 GLB in RAM; return triangles, materials and local geometry bounds. The input must be canonical base64 JSON, 28 bytes to 1.5MB; rejects external buffers/texture URLs. This is not a full glTF parser or malware certification.",
    mimeType:"application/json"
  },
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
  },
  "GET /v1/base-usdc-receipt":{
    accepts:{scheme:"exact",price:"$0.005",network:NETWORK,payTo:PAY_TO},
    description:"Validate a finalized-enough Base native Circle USDC transfer receipt with strict tx, wallet, optional sender and min threshold. A failed or unconfirmed transfer does not reach payment.",
    mimeType:"application/json"
  },
  "GET /v1/x402-template":{
    accepts:{scheme:"exact",price:PRICE,network:NETWORK,payTo:PAY_TO},
    description:"Machine-readable original OpenAPI 3.0.3 x402 payment starter with zero Redocly lint findings. An original as-is reference download, not an audited production payment service.",
    mimeType:"application/json",
    extensions:declareDiscoveryExtension({
      method:"GET",
      output:{example:{
        ok:true,paid:true,chargedUSDC:"0.01",network:NETWORK,
        kind:"x402_v2_openapi_starter",templateFormat:"YAML",
        openapiTemplate:"openapi: 3.0.3",
        redocly:{errors:0,warnings:0}
      }}
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
const MAX_REQUESTS_PER_MINUTE=process.env.NODE_ENV==="test"?1000:90;
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
app.get("/llms.txt",(_req,res)=>res.status(200).type("text/plain; charset=utf-8").send(fs.readFileSync(path.resolve(DIR,"verification/llms.txt"),"utf8")));
app.get("/health",(_req,res)=>res.json({ok:true,service:"vm5-openapi-x402",network:NETWORK,paidRoute:"POST /v1/lint",sampleRedoclyErrors:sampleReport.errors}));
app.get("/v1/docs",(_req,res)=>res.json(documentation));
app.get("/v1/email-dns-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  sample:{kind:"public_email_dns_preflight",domain:"example.org",mxCount:1,spfPresent:true,dmarcPresent:true,dmarcPolicy:"reject",warnings:[],inspectedAtUTC:"FIXTURE_ONLY_NOT_LIVE_DNS"},
  paidEndpoint:"GET /v1/email-dns-preflight?domain=gmail.com",priceUSDC:"0.005",confirmedIndependentCustomers:0,
  caveat:"A synthetic fixture, not an actual DNS inspection or paid buyer order. Paid endpoint queries live public DNS MX, SPF and DMARC but cannot verify email deliverability, mailbox existence, DKIM selectors or security."
}));
app.get("/v1/receipt-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",exampleOnly:true,
  kind:"SYNTHETIC_BASE_CIRCLE_USDC_RECEIPT_FIXTURE_NOT_REAL_CHAIN_DATA",
  paymentScheme:"x402 v2 Base (chainId 8453) native Circle USDC only",
  exampleInput:{
    tx:"0x"+"a".repeat(64),
    recipient:"0x"+"4".repeat(40),
    minUsdc:"3.000000",
    sender:"0x"+"3".repeat(40)
  },
  illustrativeOutput:{
    verifiedNativeUSDCReceipt:true,
    chainId:8453,
    transactionHash:"0x"+"a".repeat(64),
    expectedRecipient:"0x"+"4".repeat(40),
    expectedSender:"0x"+"3".repeat(40),
    netIncomingUSDC:"4.000000",
    minimumUSDC:"3.000000",
    confirmations:"18",
    chargedUSDC:"0.005",
    payment:"EXAMPLE ONLY — not a settled buyer authorization"
  },
  paidEndpoint:"GET /v1/base-usdc-receipt",priceNativeBaseCircleUSDC:"0.005",
  confirmedIndependentPaidOrdersForThisEndpoint:0,
  limitations:"These addresses, block confirmations and transaction hash are invented placeholders, NOT an observed chain receipt, a verified customer, actual settlement, domain identity, buyer intent or paid result. Replace every sample input with your own PUBLIC real Base native Circle USDC transaction and expected wallet. Real API rejects missing, forged, bridged, unconfirmed, failed and insufficient payments BEFORE requesting any x402 charge."
}));
app.get("/v1/sales-proof",(_req,res)=>res.status(200).json({
  kind:"original_x402_first_actual_independent_paid_sale",
  source:"NoHumans firstparty paid_verified/paid_verification_latest and independent Base8453 USDC receipt; evidence frozen at 2026-10-19, not live sales analytics.",
  externalBuyer:"NoHumans independent paid-verification scout",
  externalSellerListing:"https://nohumans.directory/l/7fb76f81-0b5",
  exactPaidProduct:"GET /v1/x402-template",
  nativeCircleBaseUSDCReceived:"0.01", verifiedUniquePaidCalls:1,
  allVerifiedDistinctPaidApiCalls:2,
  totalActuallyReceivedNativeBaseCircleUSDC:"0.015",
  secondCsvPaidReceipt:{
    endpoint:"GET /v1/csv-report",listing:"https://nohumans.directory/l/816d6709-3d0",
    paidNativeCircleBaseUSDC:"0.005",paidVerified:true,delivered:true,schemaValidated:true,
    txHash:"0xc0c69aa8709b848ab3c0d521ac6540e019738f0804565dfe19652bcb3c290838",
    logIndex:1201,chainId:8453,token:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    from:"0x54e163e9b8edda194d83f46add921bfa5fc5f4e0",to:PAY_TO,
    dateUTC:"2026-10-19T13:38:49Z",
    sameIndependentAutomatedScoutBuyerAsFirst:true
  },
  paidVerified:true,officialProductDelivered:true,responseSchemaValidated:true,
  dateUTC:"2026-10-19T11:34:15Z",chainId:8453,
  USDCAsset:"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  recipientPublicAddress:PAY_TO,
  independentBuyerPublicScout:"0x54E163e9B8eDDa194D83F46AdD921bfA5fc5f4E0",
  txHash:"0x5ced9d7d47a864b62afd408d785e0cf7a6b0cc862a6940630ee9283ce18be912",
  logIndex:239,
  transactionExplorer:"https://basescan.org/tx/0x5ced9d7d47a864b62afd408d785e0cf7a6b0cc862a6940630ee9283ce18be912",
  officialBuyerPolicy:"https://nohumans.directory/state/paid-verification",
  noOwnerWalletGasOrSignedSelfPurchase:true,
  generatedLowPolyPaidCustomers:0,
  paidGlbAuditorPaidCustomers:0,
  otherPaidEndpointCustomersNotProven:true,
  fiatCashoutUSD:"0",trueNetUSD:"UNKNOWN",
  disclaimer:"Two small independently purchased/delivered API calls by ONE external automated NoHumans scout (0.01 template + 0.005 CSV); not an enterprise software contract, two organic buyer testimonials, sustained demand, exclusive IP transfer, USD bank cashout or guaranteed future revenue. Legacy top-level transaction fields refer only to the original first call; separate total fields include both unique transactions."
}));
app.get("/v1/sample",(_req,res)=>res.json({kind:"public_sample",sampleTitle:"Independently authored JSONPlaceholder OpenAPI 3.0 spec",...sampleReport,paid:false,source:"https://github.com/livastic-vm5-primary-20260911/vm5-delivery-lab/tree/main/examples"}));
app.get("/v1/csv-sample",(_req,res)=>res.json({
  ok:true,paid:false,kind:"original_synthetic_csv_structural_qa_offer",
  sampleCsv:DEMO_CSV,requestedExpectedHeaders:["email","amount","date","note"],
  paidGET:"GET /v1/csv-report",paidPOST:"POST /v1/csv-preflight",
  priceUSDC:"0.005",network:NETWORK,
  sourceDataset:"Synthetic original public demo only, no personal/customer data",
  issuesPresent:["one duplicate data row","one irregular column count",
    "invalid email/amount/date", "one formula-risk cell","one blank amount"],
  disclosure:"GET paid sample is reproducible from this synthetic data using public code; POST is for buyer-supplied CSV. Charges buy hosted structured report convenience, not exclusive IP or safety certification.",
  confirmedCsvPaidOrders:1,
  limits:CSV_LIMITS
}));
app.get("/v1/lowpoly-sample",(_req,res)=>res.json({
  ok:true,paid:false,kind:"reproducible_original_lowpoly_glb_generator_preview",
  kinds:["lantern","marker"],defaultKind:"lantern",seedRange:[0,999999],
  bytesPerGeneratedModel:"about 17-28KB GLB 2.0",
  format:"GLB 2.0, Y-up; model-local metre-scale positions; solid-color materials; no external mesh or textures",
  paidEndpoint:"GET /v1/generate-lowpoly",priceUSDC:"0.05",network:NETWORK,
  product:"An as-is procedurally generated GLB model byte array returned as base64 after real independent native Base Circle USDC x402 payment.",
  licensing:"Non-exclusive as-is commercial use only of rights VM5 actually owns and can license; AI-assisted and generator source is public; no exclusivity/Unity runtime certification/seller prior paid orders.",
  independentPaidBuyers:0,confirmedSettledSalesUSDC:"0",
  demo:"https://livastic-vm5-primary-20260911.github.io/last-one-3d-survival-demo/props.html"
}));
app.get("/v1/glb-sample",(_req,res)=>res.json({ok:true,paid:false,kind:"original_portfolio_metadata_example",
  sampleSource:"Original VM5 portfolio at https://livastic-vm5-primary-20260911.github.io/last-one-3d-survival-demo/props.html",
  examples:[{name:"forest_lantern",triangleCount:380,materialCount:8,localHeightMetres:1.82},
    {name:"moss_marker",triangleCount:228,materialCount:4,localHeightMetres:1.9}],
  disclosure:"These are synthetic self-authored geometry samples; not customer orders, not independent paid tests, not renderer or security certification."}));
let inFlightUSDCReads=0;
const pendingUSDCByIp=new Map();
app.get("/v1/base-usdc-receipt",async(req,res,next)=>{
  // Free RPC preflight is deliberately bounded so unauthenticated users
  // cannot turn the x402 seller into a public Base RPC amplification proxy.
  const now=Date.now();
  const who=req.ip;
  const prev=pendingUSDCByIp.get(who);
  const item=(!prev||now-prev.started>60000)?{started:now,count:0}:prev;
  item.count++;
  pendingUSDCByIp.set(who,item);
  if(pendingUSDCByIp.size>10000)
    for(const [ip,entry] of pendingUSDCByIp)
      if(now-entry.started>60000)pendingUSDCByIp.delete(ip);
  if(item.count>12)
    return res.status(429).json({ok:false,charged:false,error:"Base receipt read rate limit; retry later."});
  if(inFlightUSDCReads>=2)
    return res.status(503).json({ok:false,charged:false,error:"Base receipt reader busy; no payment accepted."});

  const parsed=validateReceiptQuery(req.query);
  if(!parsed.ok)return res.status(400).json({ok:false,charged:false,error:parsed.error});
  inFlightUSDCReads++;
  try{
    const result=await preflightBaseUSDCReceipt(parsed.value);
    if(!result.ok)return res.status(result.httpStatus).json({ok:false,charged:false,error:result.error});
    res.locals.usdcReceiptProof=result.proof;
    next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Base receipt verifier or read-only chain source temporarily unavailable. No payment requested."});
  }finally{
    inFlightUSDCReads=Math.max(0,inFlightUSDCReads-1);
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.usdcReceiptProof,
  chargedUSDC:"0.005",
  payment:"x402 v2 exact Base Circle native USDC. Real independent payment settlement NOT yet demonstrated on production."
}));
// Compatibility for legacy marketplace probes: x402 v2's canonical PaymentRequired
// stays in PAYMENT-REQUIRED; mirror that identical public quote in a JSON 402 body
// only for the already-paid GET template route. Do not change any payment/settlement.
function echoCanonicalX402ChallengeOnTemplate(_req,res,next) {
  const send=res.send;
  res.send=function(body) {
    const wire=res.getHeader("PAYMENT-REQUIRED");
    if (res.statusCode===402 && typeof wire==="string" && wire.length<20000) {
      try {
        const quote=JSON.parse(Buffer.from(wire,"base64").toString("utf8"));
        const a=quote?.accepts;
        if (quote?.x402Version===2 && Array.isArray(a) && a.length===1 &&
            a[0]?.scheme==="exact" && a[0]?.network===NETWORK &&
            a[0]?.payTo?.toLowerCase()===PAY_TO.toLowerCase() &&
            a[0]?.asset?.toLowerCase()==="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" &&
            a[0]?.amount==="10000") {
          res.setHeader("X-Payment-Required",wire); // legacy discovery alias, same bytes
          res.setHeader("Access-Control-Expose-Headers",
                        "PAYMENT-REQUIRED,X-Payment-Required,PAYMENT-RESPONSE");
          res.type("json");
          return send.call(res,JSON.stringify(quote));
        }
      }catch { /* Fail closed to the standard x402 middleware response */ }
    }
    return send.call(res,body);
  };
  next();
}

function validateOptionalTemplateFormat(req,res,next){
  const format=req.get("X-Template-Format");
  if(Object.keys(req.query).length ||
     (format!==undefined && format!=="yaml")){
    return res.status(400).json({ok:false,charged:false,error:"Only the optional X-Template-Format: yaml header is supported; this paid URL takes no query string."});
  }
  next();
}
app.get("/v1/x402-template",validateOptionalTemplateFormat,echoCanonicalX402ChallengeOnTemplate,payment,(_req,res)=>res.status(200).json({
  ok:true,paid:true,chargedUSDC:"0.01",network:NETWORK,
  kind:"x402_v2_openapi_starter",templateFormat:"YAML",openapiTemplate:paymentTemplate,
  redocly:paymentTemplateReport,
  disclosure:"Original reference template and lint evidence only; not an operating payment API or a guarantee that your server settles USDC. Replace all placeholder hosts and implement secure verification."
}));
app.get("/openapi.json",(req,res)=>{
  try{const origin=req.protocol+"://"+req.get("host");res.json(makeDiscovery(origin).spec);}
  catch{return res.status(503).json({error:"Discovery host not available."});}
});
app.get(["/.well-known/x402","/.well-known/x402.json"],(req,res)=>{
  try{const origin=req.protocol+"://"+req.get("host");res.json(makeDiscovery(origin).wellKnown);}
  catch{return res.status(503).json({error:"Discovery host not available."});}
});

app.options(["/v1/lint","/v1/analyze-glb","/v1/csv-preflight"],(_req,res)=>res.status(204).end());

const emailDnsRates=new Map();
app.get("/v1/email-dns-preflight",async(req,res,next)=>{
  const now=Date.now(),ip=req.ip,previous=emailDnsRates.get(ip);
  const item=(!previous||now-previous.at>60000)?{at:now,count:0}:previous;
  item.count++;emailDnsRates.set(ip,item);
  if(emailDnsRates.size>3000)for(const [key,state] of emailDnsRates)if(now-state.at>60000)emailDnsRates.delete(key);
  if(item.count>12)return res.status(429).json({ok:false,charged:false,error:"Public DNS lookup limited to twelve attempts/minute/IP."});
  const keys=Object.keys(req.query);
  if(keys.length>1||keys.some(key=>key!=="domain")||keys.some(key=>typeof req.query[key]!=="string"))
    return res.status(400).json({ok:false,charged:false,error:"Only an optional single public domain query is permitted."});
  const input=validatePublicDomain(req.query.domain===undefined?"gmail.com":req.query.domain);
  if(!input.ok)return res.status(400).json({ok:false,charged:false,error:input.error});
  try{
    const report=await auditEmailDns(input.domain);
    if(!report.ok)return res.status(404).json({ok:false,charged:false,error:report.error});
    res.locals.emailDnsReport=report;
    return next();
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"Public DNS resolver is unavailable. No payment requested."});
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.emailDnsReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  disclaimer:"Read-only public DNS configuration preflight, not domain ownership, SMTP deliverability, DKIM, authorization or security certification. DNS results may change."
}));
app.get("/v1/x402-sample",(_req,res)=>res.status(200).json({
  ok:true,paid:false,chargedUSDC:"0",sampleOnly:true,
  version:VM3_QUOTE_VERSION,
  kind:"vm3_original_vm5_hosted_public_x402_quote_sample",
  exampleQuote:EXAMPLE_QUOTE,
  analysis:{...evaluatePublicQuote(EXAMPLE_QUOTE),paid:false,chargedUSDC:"0"},
  paidEndpoint:"GET /v1/x402-preflight",priceNativeBaseCircleUSDC:"0.01",
  originalAdaptedSource:"VM3 original same-owner MIT x402 quote preflight, VM5 bounded hosted version",
  caveat:"EXAMPLE.INVALID and syntactic fake payTo 0x111... are NOT a real merchant or original VM5 customer; VM5 actual payable x402 challenge uses configured VM5 public recipient."
}));
const quotePreflightRates=new Map();
app.get("/v1/x402-preflight",(req,res,next)=>{
  const id=req.ip,now=Date.now(),old=quotePreflightRates.get(id);
  const state=(!old||now-old.at>60000)?{at:now,count:0}:old;
  state.count++;quotePreflightRates.set(id,state);
  if(quotePreflightRates.size>3000)for(const [key,item] of quotePreflightRates)if(now-item.at>60000)quotePreflightRates.delete(key);
  if(state.count>12)return res.status(429).json({ok:false,charged:false,error:"Public x402 quote preflight limited to twelve attempts per minute."});
  if(req.originalUrl.length>17500)return res.status(413).json({ok:false,charged:false,error:"Quote query exceeds 17500 characters."});
  const keys=Object.keys(req.query);
  if(keys.length>1||keys.some(key=>key!=="quote"))
    return res.status(400).json({ok:false,charged:false,error:"Only one optional quote query string accepted."});
  try{
    const report=evaluatePublicQuote(parsePublicQuote(req.query.quote));
    if(report.checkCount!==8 || !Array.isArray(report.checks))
      return res.status(400).json({ok:false,charged:false,error:"Unexpected quote evaluator result."});
    res.locals.quotePreflightReport=report;
    return next();
  }catch(error){
    return res.status(400).json({ok:false,charged:false,error:typeof error.code==="string"?error.code:"INVALID_UNSIGNED_PUBLIC_QUOTE"});
  }
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.quotePreflightReport,paid:true,chargedUSDC:"0.01",network:NETWORK,
  originalSource:"VM3 authored public-source x402 402 quote syntax QA; VM5 existing hosted service and public recipient",
  disclaimer:"No merchant visited; public quote syntax is NOT seller identity, actual payment settlement, customer delivery or safe merchant verification."
}));

app.get("/v1/csv-report",(req,res,next)=>{
  if(Object.keys(req.query).length)return res.status(400).json({ok:false,charged:false,error:"CSV demo report takes no query. POST /v1/csv-preflight for buyer-owned data."});
  next();
},payment,(_req,res)=>res.status(200).json({
  ...demoCsvReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  purpose:"Reproducible original demonstration CSV anomaly report; source and analyser publicly available; this is NOT prior paid customer work."
}));

const csvRate=new Map();
app.post("/v1/csv-preflight",express.json({limit:"40kb",type:["application/json","application/*+json"]}),(req,res,next)=>{
  const now=Date.now(),ip=req.ip,previous=csvRate.get(ip);
  const count=(!previous||now-previous.at>60000)?{at:now,count:0}:previous;
  count.count++;csvRate.set(ip,count);
  if(csvRate.size>3000)for(const [key,v] of csvRate)if(now-v.at>60000)csvRate.delete(key);
  if(count.count>12)return res.status(429).json({ok:false,charged:false,error:"CSV preflight limited to twelve attempts/minute/IP."});
  if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({ok:false,charged:false,error:"Use JSON application body."});
  const checked=inspectCsv(req.body);
  if(!checked.ok)return res.status(400).json({ok:false,charged:false,error:checked.reason,limits:CSV_LIMITS});
  res.locals.csvReport=checked;
  next();
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.csvReport,paid:true,chargedUSDC:"0.005",network:NETWORK,
  buyerDisclosure:"This is heuristic structural preflight, not a compliance/certification report, source-data proof, or guarantee of customer business results."
}));

app.get("/v1/generate-lowpoly",(req,res,next)=>{
  const allowed=Object.keys(req.query);
  if(allowed.some(k=>!["kind","seed"].includes(k)) || allowed.length>2 ||
     allowed.some(k=>typeof req.query[k]!=="string")){
    return res.status(400).json({ok:false,charged:false,error:"Only one kind and one integer seed query parameter are accepted."});
  }
  const kind=req.query.kind===undefined?"lantern":req.query.kind;
  const seedString=req.query.seed===undefined?"0":req.query.seed;
  if(!["lantern","marker"].includes(kind) || !/^(0|[1-9][0-9]{0,5})$/.test(seedString)){
    return res.status(400).json({ok:false,charged:false,error:"kind=lantern|marker; seed must be integer in [0,999999]."});
  }
  try{
    res.locals.lowpolyResult=generateOriginalGlb(kind,Number(seedString));
  }catch{
    return res.status(503).json({ok:false,charged:false,error:"The deterministic model generator did not complete. No payment required."});
  }
  next();
},payment,(_req,res)=>res.status(200).json({
  ...res.locals.lowpolyResult,ok:true,paid:true,chargedUSDC:"0.05",network:NETWORK,
  product:"AI-assisted original low-poly GLB generator with public source; as-is nonexclusive delivery. No proprietary exclusive code, guarantees, prior customer sales or renderer certification."
}));

const glbRequestByIp=new Map();
app.post("/v1/analyze-glb",
  express.json({limit:"2050kb",type:["application/json","application/*+json"]}),
  (req,res,next)=>{
    // Bound free preflight before x402; never hold a bad or oversized payload behind a charge.
    const now=Date.now(),ip=req.ip,prev=glbRequestByIp.get(ip);
    const current=(!prev||now-prev.started>60000)?{started:now,count:0}:prev;
    current.count++;glbRequestByIp.set(ip,current);
    if(glbRequestByIp.size>3000)for(const [key,v] of glbRequestByIp)if(now-v.started>60000)glbRequestByIp.delete(key);
    if(current.count>12)return res.status(429).json({ok:false,charged:false,error:"GLB analysis preflight limited to twelve attempts/minute per IP."});
    if(!req.is("application/json")&&!req.is("application/*+json"))return res.status(415).json({ok:false,charged:false,error:"Use JSON body with glbBase64 only."});
    if(!req.body || typeof req.body!=="object" || Array.isArray(req.body) ||
        Object.keys(req.body).length!==1 || !Object.prototype.hasOwnProperty.call(req.body,"glbBase64")){
      return res.status(400).json({ok:false,charged:false,error:"Provide only {glbBase64: base64 of a glTF 2.0 binary GLB}.",maxGLBBytes:MAX_GLB_BYTES});
    }
    const report=parseGlbBase64(req.body.glbBase64);
    if(!report.ok)return res.status(400).json({ok:false,charged:false,error:report.error,maxGLBBytes:MAX_GLB_BYTES});
    res.locals.glbReport=report;
    next();
  },
  payment,
  (_req,res)=>res.status(200).json({...res.locals.glbReport,kind:"glb_v2_geometry_audit",
    paid:true,chargedUSDC:"0.01",network:NETWORK,
    disclosure:"x402 requires an independent signed buyer authorization and actual settlement. This GLB metadata endpoint itself has ZERO verified paid calls as of first-sale proof; a DIFFERENT template GET endpoint sold once externally for 0.01 native Base USDC in Oct 2026. No GLB upload customer sale is claimed."})
);

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
