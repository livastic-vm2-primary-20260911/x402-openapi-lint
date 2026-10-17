// Machine-readable origin-specific discovery for x402scan and standard OpenAPI clients.
// Read-only, no remote calls, never exposes customer docs or platform credentials.
export function makeDiscovery(origin) {
  if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) && origin!=="https://vm5-openapi-x402.onrender.com" && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)){
    throw Error("Unexpected public origin");
  }
  const endpoint=origin+"/v1/lint";
  const templateEndpoint=origin+"/v1/x402-template";
  const payInfo={
    protocols:["x402"],
    price:{mode:"fixed",currency:"USD",amount:"0.01"},
    network:"eip155:8453",
    asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo:"0x6b01efA0705E91a7aca54271510bf9e594717f34"
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
      "/v1/x402-template":{get:{
        tags:["Lint"],summary:"Verified x402 v2 OpenAPI template for 0.01 Base USDC",
        operationId:"getX402OpenApiTemplate",security:[{x402Payment:[]}],
        description:"Return an original OpenAPI 3.0.3 payment-template YAML document and its zero-error Redocly recommended lint report. This is a DESIGN template, not an active settlement or security guarantee.",
        "x-payment-info":payInfo,
        responses:{
          "200":{description:"Paid OpenAPI template, pinned Redocly lint report and limitations."},
          "402":{description:"x402 Base USDC signed payment required.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"},description:"Base64 x402 v2 payment requirements, amount 10000 USDC atomic units."}}},
          "429":{description:"Request rate limited before any payment."}
        }
      }},
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
    resources:[endpoint,templateEndpoint],
    instructions:"Paid POST /v1/lint requires JSON {spec:'OpenAPI YAML string'} before a 402 quote. Paid GET /v1/x402-template returns a verified original x402 v2 OpenAPI reference document. GET /v1/sample remains free. No live USDC settlement has yet been verified.",
    claim:"discovered x402 quote only, not an observed settled payment"
  };
  return {spec,wellKnown};
}
