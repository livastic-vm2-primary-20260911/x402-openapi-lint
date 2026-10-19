// Machine-readable origin-specific discovery for x402scan and standard OpenAPI clients.
// Read-only, no remote calls, never exposes customer docs or platform credentials.
export function makeDiscovery(origin) {
  if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) && origin!=="https://vm5-openapi-x402.onrender.com" && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)){
    throw Error("Unexpected public origin");
  }
  const endpoint=origin+"/v1/lint";
  const templateEndpoint=origin+"/v1/x402-template";
  const receiptEndpoint=origin+"/v1/base-usdc-receipt";
  const glbEndpoint=origin+"/v1/analyze-glb";
  const payInfo={
    protocols:["x402"],
    price:{mode:"fixed",currency:"USD",amount:"0.01"},
    network:"eip155:8453",
    asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo:"0x6b01efA0705E91a7aca54271510bf9e594717f34"
  };
  const receiptPayInfo={
    ...payInfo,
    price:{mode:"fixed",currency:"USD",amount:"0.005"}
  };
  const spec={
    openapi:"3.1.0",
    info:{
      title:"VM5 OpenAPI Lint — x402 micropayment",
      version:"0.1.0",
      description:"AI-assisted, transparent OpenAPI YAML/JSON lint via pinned Redocly recommended rules. Free sample available. Paid POST returns structured errors/warnings. Real on-chain payment settlement has NOT been tested.",
      contact:{name:"VM5 Delivery Lab",url:"https://livastic-vm5-primary-20260911.github.io/vm5-delivery-lab/"}
    },
    servers:[{url:origin}],
    tags:[{name:"Lint",description:"OpenAPI YAML/JSON developer documentation lint, not a security audit."}],
    security:[],
    components:{
      securitySchemes:{
        x402Payment:{type:"apiKey",in:"header",name:"PAYMENT-SIGNATURE",description:"A valid client-signed x402 v2 USDC EIP-3009 payment authorization (not a static API key). No wallet seed or private key is sent."}
      },
      schemas:{
        LintRequest:{type:"object",additionalProperties:false,required:["spec"],properties:{spec:{type:"string",maxLength:64000,description:"UTF-8 OpenAPI 3.x JSON/YAML string. External references disabled.",examples:["openapi: 3.0.3\ninfo:\n  title: Example\n  version: '1'\npaths: {}"]}}},
        LintResult:{type:"object",properties:{ok:{type:"boolean"},chargedUSDC:{type:"string"},network:{type:"string"},redocly:{type:"object",properties:{valid:{type:"boolean"},errors:{type:"integer"},warnings:{type:"integer"},findings:{type:"array",items:{type:"object"}}}}}}
      }
    },
    paths:{
      "/health":{get:{summary:"Free health check",operationId:"health",security:[],responses:{"200":{description:"Current service health."}}}},
      "/v1/docs":{get:{summary:"Free API documentation and payment terms",operationId:"readApiContract",security:[],responses:{"200":{description:"Public terms, recipient and schema."}}}},
      "/v1/sample":{get:{summary:"Free, full reference lint report",operationId:"sampleLint",security:[],responses:{"200":{description:"Public independently verified example."}}}},
      "/v1/glb-sample":{get:{summary:"Free original self-produced 3D model metadata preview",operationId:"readGlbMetadataSample",security:[],responses:{"200":{description:"Not a paid customer job; public sample with private source retained."}}}},
      "/v1/base-usdc-receipt":{get:{
        summary:"Verify Base Circle USDC transaction receipt for 0.005 USDC",
        operationId:"verifyBaseUSDCReceipt",
        description:"A read-only paid JSON proof for a successful confirmed Base native Circle USDC ERC20 Transfer, requiring 12 observed blocks, positive NET tokens received, optional exact external transfer sender and integer-safe minimum threshold. Public input errors, missing, unsuccessful and unconfirmed transfers are rejected without a 402 charge. No invoice intent or buyer identity verification; no wallet signatures performed by the service.",
        security:[{x402Payment:[]}],
        "x-payment-info":receiptPayInfo,
        parameters:[
          {name:"tx",in:"query",required:true,description:"0x-prefixed 32-byte Base transaction hash. Public sample from an unrelated independently-funded historical AgentBounties escrow; NOT a VM5 customer payment.",schema:{type:"string",pattern:"^0x[0-9a-fA-F]{64}$",example:"0x53aac65f9e41a01430851290ef634b4ee9c8b933511cc8f8b6abbc2ead82a54d"}},
          {name:"recipient",in:"query",required:true,description:"Expected native Circle USDC recipient. Public example is an unrelated escrow contract, NOT the VM5 seller payTo.",schema:{type:"string",pattern:"^0x[0-9a-fA-F]{40}$",example:"0xbf99f1c2c690c8bcd45e341006bf7b7dd6c41cdc"}},
          {name:"minUsdc",in:"query",required:true,description:"USDC threshold, up to six fractional places. Example matches the unrelated public transaction; not VM5 revenue.",schema:{type:"string",example:"21.300000"}},
          {name:"sender",in:"query",required:false,description:"Optional expected native USDC Transfer from wallet, not KYC or invoice proof",schema:{type:"string",pattern:"^0x[0-9a-fA-F]{40}$"}}
        ],
        responses:{
          "200":{description:"Genuine, paid read-only native Circle USDC receipt proof. Payer intent not certified.",content:{"application/json":{schema:{type:"object",required:["verifiedNativeUSDCReceipt","transactionHash","netIncomingUSDC","chargedUSDC"],properties:{verifiedNativeUSDCReceipt:{type:"boolean"},transactionHash:{type:"string",pattern:"^0x[0-9a-fA-F]{64}$"},chainId:{type:"integer",example:8453},netIncomingUSDC:{type:"string"},minimumUSDC:{type:"string"},confirmations:{type:"string"},chargedUSDC:{type:"string",example:"0.005"},payment:{type:"string"}}}}}},
          "400":{description:"Invalid wallet/hash/minimum/duplicate query data, rejected before payment."},
          "402":{description:"Exact x402 USDC payment required; 0.005 USDC on Base.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
          "404":{description:"Transaction not found, no payment required."},
          "409":{description:"Failed transaction, no payment required."},
          "422":{description:"Insufficient token net received or wrong sender, no payment required."},
          "425":{description:"Fewer than twelve recent Base blocks, no payment required."},
          "503":{description:"Public Base RPC unavailable, no payment requested."}
        }
      }},
      "/v1/x402-template":{get:{
        tags:["Lint"],summary:"Verified x402 v2 OpenAPI template for 0.01 Base USDC",
        operationId:"getX402OpenApiTemplate",security:[{x402Payment:[]}],
        description:"Return an original OpenAPI 3.0.3 payment-template YAML document and its zero-error Redocly recommended lint report. This is a DESIGN template, not an active settlement or security guarantee.",
        "x-payment-info":payInfo,
        parameters:[{name:"X-Template-Format",in:"header",required:false,description:"Optional format hint; only YAML is supported. The paid URL takes no query string; omitting the header is equivalent to YAML.",schema:{type:"string",enum:["yaml"],default:"yaml",example:"yaml"}}],
        responses:{
          "200":{description:"Paid OpenAPI YAML template, pinned Redocly lint report and limitations.",content:{"application/json":{schema:{type:"object",required:["ok","paid","kind","templateFormat","openapiTemplate","chargedUSDC"],properties:{ok:{type:"boolean"},paid:{type:"boolean"},chargedUSDC:{type:"string",example:"0.01"},network:{type:"string",example:"eip155:8453"},kind:{type:"string",enum:["x402_v2_openapi_starter"]},templateFormat:{type:"string",enum:["YAML"]},openapiTemplate:{type:"string",description:"Verified example OpenAPI YAML; replace all placeholder hosts."},redocly:{type:"object"},disclosure:{type:"string"}}}}}},
          "400":{description:"Unsupported format or unexpected query parameter, rejected before payment."},
          "402":{description:"x402 Base USDC signed payment required.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"},description:"Base64 x402 v2 payment requirements, amount 10000 USDC atomic units."}}},
          "429":{description:"Request rate limited before any payment."}
        }
      }},
      "/v1/analyze-glb":{
        post:{
          tags:["Lint"],summary:"Audit local glTF GLB model geometry for 0.01 native Base USDC",
          operationId:"analyzeGlbGeometry",
          description:"In-memory glTF 2 binary metadata and accessors audit: material/image/mesh/triangles/local bounding boxes. Strict canonical Base64, <=1.5MB. Rejects remote buffers, textures and unsupported sparse accessors before payment. Only structural metadata, not GLB rendering or any security/malware/licensing guarantee.",
          security:[{x402Payment:[]}],
          "x-payment-info":payInfo,
          requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["glbBase64"],properties:{glbBase64:{type:"string",maxLength:2000000,contentEncoding:"base64",description:"Canonical base64-encoded glTF 2.0 GLB, 28 bytes to 1.5MB. Do not submit proprietary content without authorization."}}}}}},
          responses:{
            "200":{description:"Paid reproducible GLB metadata result, not a complete glTF compliance audit.",content:{"application/json":{schema:{type:"object",required:["ok","kind","paid","triangleCount","meshCount","chargedUSDC"],properties:{ok:{type:"boolean"},kind:{type:"string",enum:["glb_v2_geometry_audit"]},paid:{type:"boolean"},triangleCount:{type:"integer"},meshCount:{type:"integer"},materialCount:{type:"integer"},dimensions:{type:["object","null"]},chargedUSDC:{type:"string",example:"0.01"},warnings:{type:"array",items:{type:"string"}}}}}}},
            "400":{description:"Malformed, oversized or unsupported GLB; rejected BEFORE x402 challenge."},
            "402":{description:"Pay 0.01 Circle native Base USDC with x402 v2 signed authorization.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
            "413":{description:"Request exceeds body limit; rejected without payment."},
            "429":{description:"Too many attempts per minute, rejected without payment."}
          }
        }
      },
      "/v1/lint":{
        post:{
          tags:["Lint"],summary:"Lint OpenAPI YAML or JSON for 0.01 Base USDC",
          operationId:"lintOpenApi",
          description:"One user-supplied OpenAPI 3.x YAML/JSON document. Validate input before issuing x402 payment requirement. The output is a Redocly recommended-rule report; lint findings are the product, not a service failure. Actual payment settlement has not been tested in VM5.",
          security:[{x402Payment:[]}],
          "x-payment-info":payInfo,
          requestBody:{required:true,description:"Send one YAML/JSON string (no private data or external $refs).",content:{"application/json":{schema:{$ref:"#/components/schemas/LintRequest"},example:{spec:"openapi: 3.0.3\ninfo:\n  title: Example\n  version: '1'\npaths: {}"}}}},
          responses:{
            "200":{description:"Paid structured lint report, including defects.",content:{"application/json":{schema:{$ref:"#/components/schemas/LintResult"}}}},
            "400":{description:"Invalid JSON/OpenAPI document, rejected before payment."},
            "402":{description:"x402 v2 Base USDC payment authorization required. Parse PAYMENT-REQUIRED header.",headers:{"PAYMENT-REQUIRED":{description:"Base64-encoded x402 v2 payment challenge with amount 10000 and recipient.",schema:{type:"string"}}}},
            "413":{description:"Payload too large, rejected before payment."},
            "429":{description:"Per-IP request limit exceeded."},
            "503":{description:"Service temporarily unavailable, including failed validator execution."}
          }
        }
      }
    },
    "x-discovery":{provider:"VM5 Delivery Lab",productUrl:"https://livastic-vm5-primary-20260911.github.io/x402-openapi-lint/",settlementTestStatus:"untested"}
  };
  const wellKnown={
    version:1,
    resources:[endpoint,templateEndpoint,receiptEndpoint,glbEndpoint],
    instructions:"Paid GET /v1/base-usdc-receipt proves native Circle USDC transfer on Base for 0.005 USDC. POST /v1/lint validates OpenAPI for 0.01 USDC. Paid GET /v1/x402-template serves verified original reference for 0.01 USDC. New POST /v1/analyze-glb reviews glTF 2.0 binary geometry and material metadata for 0.01 USDC. Input errors rejected before payment. GET /v1/sample and /v1/glb-sample free. No independent live payment settled yet.",
    claim:"discovered x402 quote only, not an observed settled payment"
  };
  return {spec,wellKnown};
}
