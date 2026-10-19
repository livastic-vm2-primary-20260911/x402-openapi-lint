// Machine-readable origin-specific discovery for x402scan and standard OpenAPI clients.
// Public original synthetic one-triangle sample enables valid POST paywall probes; no private assets.
const SYNTHETIC_TRIANGLE_GLB_BASE64="Z2xURgIAAABYAQAAGAEAAEpTT057ImFzc2V0Ijp7InZlcnNpb24iOiIyLjAifSwiYnVmZmVycyI6W3siYnl0ZUxlbmd0aCI6MzZ9XSwiYnVmZmVyVmlld3MiOlt7ImJ1ZmZlciI6MCwiYnl0ZU9mZnNldCI6MCwiYnl0ZUxlbmd0aCI6MzZ9XSwiYWNjZXNzb3JzIjpbeyJidWZmZXJWaWV3IjowLCJjb21wb25lbnRUeXBlIjo1MTI2LCJjb3VudCI6MywidHlwZSI6IlZFQzMiLCJtaW4iOlswLDAsMF0sIm1heCI6WzEsMSwwXX1dLCJtZXNoZXMiOlt7InByaW1pdGl2ZXMiOlt7ImF0dHJpYnV0ZXMiOnsiUE9TSVRJT04iOjB9fV19XX0gJAAAAEJJTgAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAA=";

// Read-only, no remote calls, never exposes customer docs or platform credentials.
export function makeDiscovery(origin) {
  if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin) && origin!=="https://vm5-openapi-x402.onrender.com" && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)){
    throw Error("Unexpected public origin");
  }
  const endpoint=origin+"/v1/lint";
  const templateEndpoint=origin+"/v1/x402-template";
  const receiptEndpoint=origin+"/v1/base-usdc-receipt";
  const glbEndpoint=origin+"/v1/analyze-glb";
  const lowpolyEndpoint=origin+"/v1/generate-lowpoly";
  const csvReportEndpoint=origin+"/v1/csv-report";
  const csvPreflightEndpoint=origin+"/v1/csv-preflight";
  const x402QuoteEndpoint=origin+"/v1/x402-preflight";
  const emailDnsEndpoint=origin+"/v1/email-dns-preflight";
  const httpsCertEndpoint=origin+"/v1/https-cert-preflight";
  const payInfo={
    protocols:["x402"],
    price:{mode:"fixed",currency:"USD",amount:"0.01"},
    network:"eip155:8453",
    asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo:"0x6b01efA0705E91a7aca54271510bf9e594717f34"
  };
  const lowpolyPayInfo={...payInfo,price:{mode:"fixed",currency:"USD",amount:"0.05"}};
  const receiptPayInfo={
    ...payInfo,
    price:{mode:"fixed",currency:"USD",amount:"0.005"}
  };
  const spec={
    openapi:"3.1.0",
    info:{
      title:"VM5 OpenAPI Lint — x402 micropayment",
      version:"0.1.0",
      description:"AI-assisted OpenAPI lint, GLB delivery, CSV quality and VM3-authored public x402 quote QA hosted by VM5. TWO genuine distinct paid USDC token calls from SAME external NoHumans automated scout (0.01+0.005=0.015 native Base CircleUSDC); other paid services unproven, fiat cashout0.",
      contact:{name:"VM5 Delivery Lab",url:"https://livastic-vm5-primary-20260911.github.io/vm5-delivery-lab/"}
    },
    servers:[{url:origin}],
    tags:[{name:"Lint",description:"OpenAPI YAML/JSON developer documentation lint, not a security audit."},
      {name:"3D Models",description:"AI-assisted original procedural GLB asset generation, only non-exclusive licensable rights."},
      {name:"Data Quality",description:"Original CSV structural preflight; no raw row cells returned, not legal or security certification."},
      {name:"Payment Protocol",description:"Original same-owner VM3 x402 v2 unsigned public quote syntax preflight, VM5 hosted; no live merchant, payment or identity verification."}],
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
      "/llms.txt":{get:{summary:"Free machine-readable API guide",operationId:"readMachineApiGuide",security:[],responses:{"200":{description:"Public plain-text tool, prices, samples and source links; no wallet/payment required."}}}},
      "/health":{get:{summary:"Free health check",operationId:"health",security:[],responses:{"200":{description:"Current service health."}}}},
      "/v1/docs":{get:{summary:"Free API documentation and payment terms",operationId:"readApiContract",security:[],responses:{"200":{description:"Public terms, recipient and schema."}}}},
      "/v1/sample":{get:{summary:"Free, full reference lint report",operationId:"sampleLint",security:[],responses:{"200":{description:"Public independently verified example."}}}},
      "/v1/glb-sample":{get:{summary:"Free original self-produced 3D model metadata preview",operationId:"readGlbMetadataSample",security:[],responses:{"200":{description:"Not a paid customer job; public sample with private source retained."}}}},
      "/v1/tls-certificate-sample":{get:{
        tags:["Public TLS"],summary:"Free explicitly fictional public TLS certificate report illustration",
        operationId:"tlsCertFreeFictionalExample",security:[],
        responses:{"200":{description:"Synthetic certificate data, no actual TLS request or paid buyer."}}
      }},
      "/v1/email-dns-sample":{get:{tags:["Public DNS"],summary:"Free original illustrative email DNS configuration preview",operationId:"readEmailDnsSample",security:[],responses:{"200":{description:"Synthetic DNS only, zero paid verification or real DNS claim."}}}},
      "/v1/csv-sample":{get:{tags:["Data Quality"],summary:"Free original synthetic CSV sample and QA product scope",operationId:"readCSVStructuralPreflightSample",security:[],responses:{"200":{description:"Public synthetic CSV example, paid CSV report offer, not a paid customer test."}}}},
      "/v1/x402-sample":{get:{tags:["Payment Protocol"],summary:"Free deliberately fictional x402 quote analysis sample",operationId:"publicX402QuoteSample",security:[],responses:{"200":{description:"Original public-source fake quote, no valid seller or payment."}}}},
      "/v1/receipt-sample":{get:{
        tags:["Payment Proof"],summary:"Free explicitly fictional Base USDC receipt verifier preview",
        operationId:"getFreeSyntheticUSDCReceiptExample",security:[],
        description:"Static clearly invented transaction hash and addresses illustrate fields only. NOT onchain proof, a live RPC query, received funds, x402 signature or payment.",
        responses:{"200":{description:"Free synthetic receipt structure, paid service link, limitations and zero paid client disclosure."}}
      }},
      "/v1/sales-proof":{get:{
        summary:"Free, independently verifiable first real Base USDC buyer purchase receipt (not fiat)",
        operationId:"originalFirstIndependentPaidX402SaleProof",security:[],
        description:"One actual NoHumans external scout 0.01 native Base USDC paid and delivered GET /v1/x402-template on Oct19 2026. Hash, recipient, official NoHumans and Basescan sources. As-of historic first sale, not live sales volume. Other endpoints not yet verified.",
        responses:{"200":{description:"Original paid verification receipt with onchain and external firstparty sources; no payment required."}}
      }},
      "/v1/lowpoly-sample":{get:{summary:"Free reproducible 3D game prop offer, procedural source disclosed",operationId:"readLowpolyGeneratorOffer",security:[],responses:{"200":{description:"No-purchase disclosure of actual lowpoly hosted generator product, 0 buyer payments."}}}},
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
      "/v1/csv-report":{get:{
        tags:["Data Quality"],summary:"Reproducible synthetic CSV anomaly report for 0.005 native Base USDC",
        operationId:"buyOriginalCSVDemoReport",security:[{x402Payment:[]}],
        description:"Buyer pays for convenient fully structured report of publicly disclosed synthetic CSV. Reports duplicate records, missing cells, bad types and spreadsheet formula-risk indicators. Code and data reproducible, not proprietary IP or client sale.",
        "x-payment-info":receiptPayInfo,
        responses:{
          "200":{description:"Paid structured report for synthetic CSV (no real customer rows).",content:{"application/json":{schema:{type:"object",required:["ok","paid","chargedUSDC","dataRows","warnings"],properties:{ok:{type:"boolean"},paid:{type:"boolean"},chargedUSDC:{type:"string",example:"0.005"},dataRows:{type:"integer"},normalizedDuplicateRows:{type:"integer"},warnings:{type:"array",items:{type:"string"}},noRawDataReturned:{type:"boolean"}}}}}},
          "400":{description:"Unexpected query parameter, rejected before charge."},
          "402":{description:"Pay 0.005 native Base Circle USDC to receive the full audit report.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}}
        }
      }},
      "/v1/csv-preflight":{post:{
        tags:["Data Quality"],summary:"Audit user-supplied CSV structural data quality for 0.005 native Base USDC",
        operationId:"auditCSVStructure",security:[{x402Payment:[]}],
        description:"Customer submits UTF-8 CSV up to 32KB and optional expectedColumns up to 40. Report reveals only headers and row/column positions of anomalies, no raw data rows. CSV inspected in memory; separate infrastructure logs may apply. Invalid input is rejected before payment.",
        "x-payment-info":receiptPayInfo,
        requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["csvText"],properties:{
          csvText:{type:"string",maxLength:32768,description:"UTF-8 CSV, no NUL, <=32KB, max 500 data rows and 40 columns. Never submit secrets."},
          expectedColumns:{type:"array",items:{type:"string"},maxItems:40}}},example:{
            csvText:"email,amount,date,note\\na@example.com,12.5,2026-10-19,paid\\na@example.com,12.5,2026-10-19,paid\\nbad-email,not-a-number,2026-13-99,=1+1",
            expectedColumns:["email","amount","date","note"]}}}},
        responses:{
          "200":{description:"Paid structured CSV findings, not an audited database or GDPR certification.",content:{"application/json":{schema:{type:"object",required:["ok","paid","chargedUSDC","dataRows","columns","issues"],properties:{ok:{type:"boolean"},paid:{type:"boolean"},chargedUSDC:{type:"string",example:"0.005"},dataRows:{type:"integer"},columns:{type:"array",items:{type:"object"}},issues:{type:"array",items:{type:"object"}},noRawDataReturned:{type:"boolean"}}}}}},
          "400":{description:"Malformed CSV, invalid JSON fields, excess rows/columns, rejected before payment."},
          "402":{description:"Pay 0.005 native Circle Base USDC through x402 before returning CSV report.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
          "413":{description:"Too-large body, no payment."},
          "429":{description:"Preflight rate limit, no payment."}
        }
      }},
      "/v1/https-cert-preflight":{get:{
        tags:["Public TLS"],summary:"Public HTTPS certificate expiry and trust preflight for 0.005 Base USDC",
        operationId:"tlsCertificateExpiryPreflight",security:[{x402Payment:[]}],
        description:"Public domain-only pinned-global-IPv4 SNI TLS certificate metadata. Validity dates, issuer, hostname match and local CA trust, no HTTP request, DNS rebinding to private IP, secrets, site ownership, web-content security or revocation certification. Domain invalid or public TLS inaccessible fails BEFORE payment.",
        "x-payment-info":receiptPayInfo,
        parameters:[{name:"domain",in:"query",required:false,
          description:"Fully-qualified public DNS name only, not URL/email/private IP/port; default github.com",
          schema:{type:"string",minLength:4,maxLength:253,example:"github.com",default:"github.com"}}],
        responses:{
          "200":{description:"Paid read-only observed public certificate metadata, only after genuine independent payment.",
            content:{"application/json":{schema:{type:"object",
              properties:{ok:{type:"boolean"},paid:{type:"boolean"},chargedUSDC:{type:"string"},
                kind:{type:"string"},domain:{type:"string"},certificateExpiresAtUTC:{type:"string"},
                daysUntilExpiry:{type:"integer"},chainAuthorized:{type:"boolean"},
                hostnameMatches:{type:"boolean"},certificateTrustAndHostnameVerified:{type:"boolean"}}}}}},
          "400":{description:"Invalid/unroutable/unsafe input rejected before billing."},
          "402":{description:"x402 v2 Base native Circle USDC exact 5000 atomic payment required.",
            headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
          "429":{description:"Read-only request rate limit reached."},
          "503":{description:"Public certificate source unavailable: no payment demanded."}
        }
      }},
      "/v1/email-dns-preflight":{get:{
        tags:["Public DNS"],summary:"Read public MX/SPF/DMARC DNS policy preflight for 0.005 Base USDC",
        operationId:"inspectPublicEmailDns",security:[{x402Payment:[]}],
        description:"Read-only bounded public MX, SPF TXT, DMARC TXT and A DNS lookup. Optional domain defaults to gmail.com. Verify syntax and live DNS availability BEFORE quoting x402 payment; no mailbox probing, SMTP, DKIM selectors, domain ownership or guaranteed email deliverability. No prior verified buyer for this route.",
        "x-payment-info":receiptPayInfo,
        parameters:[{name:"domain",in:"query",required:false,description:"Public DNS domain only (not email/URL/IP/private domain); omit for gmail.com",schema:{type:"string",minLength:4,maxLength:253,example:"gmail.com",default:"gmail.com"}}],
        responses:{
          "200":{description:"After genuine x402 settlement, public email DNS configuration check; not SMTP/mailbox deliverability verification.",content:{"application/json":{schema:{type:"object",required:["ok","paid","chargedUSDC","domain","mxCount","spfPresent","dmarcPresent","warnings"],properties:{ok:{type:"boolean"},paid:{type:"boolean"},chargedUSDC:{type:"string",example:"0.005"},domain:{type:"string"},mxCount:{type:"integer"},spfPresent:{type:"boolean"},dmarcPresent:{type:"boolean"},dmarcPolicy:{type:["string","null"]},warnings:{type:"array",items:{type:"string"}},smtpContactAttempted:{type:"boolean"}}}}}},
          "400":{description:"Unsafe/invalid query rejected without payment."},
          "402":{description:"Exact 5000 atomic native Circle Base USDC payment required.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
          "404":{description:"No public domain DNS records found; rejected without payment."},
          "503":{description:"Resolver temporary error; no payment requirement."}
        }
      }},
      "/v1/x402-preflight":{get:{
        tags:["Payment Protocol"],summary:"Machine-readable public unsigned x402 402 quote structural review for 0.01 native Circle Base USDC",
        operationId:"reviewUnsignedPublicX402v2Quote",security:[{x402Payment:[]}],
        description:"Source authored by original VM3 and hosted/adapted by original VM5 under one human economic owner. Optional public unsigned x402 PAYMENT-REQUIRED JSON or Base64, or deliberately fictional no-input sample. Checks version, exact scheme, Base8453, native USDC address, payTo format and resource HTTPS syntax. NO external URL fetching, private signed data, seller identity, actual transfer proof or customer delivery check.",
        "x-payment-info":payInfo,
        parameters:[{name:"quote",in:"query",required:false,description:"Optional one PUBLIC unsigned x402 v2 PAYMENT-REQUIRED header as JSON or Base64. Omit to get the fictional sample. Never supply secrets, signed payment details, or private user data.",schema:{type:"string",maxLength:12000}}],
        responses:{
          "200":{description:"Paid original offline-only public quote structural report with explicit limitations.",content:{"application/json":{schema:{type:"object",properties:{ok:{type:"boolean"},paid:{type:"boolean"},chargedUSDC:{type:"string",example:"0.01"},reviewOutcome:{type:"string"},checks:{type:"array",items:{type:"object"}},noSpendingAuthorized:{type:"boolean"}}}}}},
          "400":{description:"Invalid public quote, duplicated input, or secret-bearing signed quote rejected BEFORE payment."},
          "402":{description:"x402 Base mainnet native Circle USDC 0.01 authorized client payment required.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
          "413":{description:"Long query rejected free."},"429":{description:"Preflight attempts limited per caller."}
        }
      }},
      "/v1/generate-lowpoly":{get:{
        tags:["3D Models"],summary:"Generate an original GLB low-poly prop for 0.05 native Base USDC",
        operationId:"generateOriginalLowPolyGlb",security:[{x402Payment:[]}],
        description:"Original deterministic AI-assisted procedural GLB output, available as non-exclusive as-is convenient service. Public source is openly reproducible and NOT proprietary or protected exclusive content. Kinds lantern/marker, integer seed optional (default lantern,0).",
        "x-payment-info":lowpolyPayInfo,
        parameters:[
          {name:"kind",in:"query",required:false,description:"Procedural lantern or stone marker, default lantern",schema:{type:"string",enum:["lantern","marker"],default:"lantern"}},
          {name:"seed",in:"query",required:false,description:"Deterministic integer model variant, 0..999999",schema:{type:"integer",minimum:0,maximum:999999,default:0}}
        ],
        responses:{
          "200":{description:"After actual independent x402 settlement, ready-to-decode canonical GLB Base64, SHA256 and transparent rights statement.",content:{"application/json":{schema:{type:"object",required:["ok","glbBase64","fileName","sha256","paid","chargedUSDC"],properties:{ok:{type:"boolean"},paid:{type:"boolean"},glbBase64:{type:"string",contentEncoding:"base64",description:"Portable glTF2 GLB binary, public-source AI-assisted generator"},fileName:{type:"string"},sha256:{type:"string"},triangles:{type:"integer"},chargedUSDC:{type:"string",example:"0.05"},licensing:{type:"string"},disclosure:{type:"string"}}}}}},
          "400":{description:"Invalid kind, seed or unexpected parameters; rejected before payment."},
          "402":{description:"Pay 0.05 native Circle Base USDC through a valid x402 v2 client.",headers:{"PAYMENT-REQUIRED":{schema:{type:"string"}}}},
          "503":{description:"Generator unavailable, no payment requested."}
        }
      }},
      "/v1/analyze-glb":{
        post:{
          tags:["Lint"],summary:"Audit local glTF GLB model geometry for 0.01 native Base USDC",
          operationId:"analyzeGlbGeometry",
          description:"In-memory glTF 2 binary metadata and accessors audit: material/image/mesh/triangles/local bounding boxes. Strict canonical Base64, <=1.5MB. Rejects remote buffers, textures and unsupported sparse accessors before payment. Only structural metadata, not GLB rendering or any security/malware/licensing guarantee.",
          security:[{x402Payment:[]}],
          "x-payment-info":payInfo,
          requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:false,required:["glbBase64"],properties:{glbBase64:{type:"string",maxLength:2000000,contentEncoding:"base64",description:"Canonical base64-encoded glTF 2.0 GLB, 28 bytes to 1.5MB. Do not submit proprietary content without authorization."}}},example:{glbBase64:SYNTHETIC_TRIANGLE_GLB_BASE64}}}},
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
    "x-discovery":{provider:"VM5 Delivery Lab",productUrl:"https://livastic-vm5-primary-20260911.github.io/x402-openapi-lint/",settlementTestStatus:"TWO_DISTINCT_REAL_BASE_USDC_PAID_DELIVERED_CALLS_0P015_USDC_SAME_AUTO_SCOUT_OCT19",independentSource:"https://nohumans.directory/l/7fb76f81-0b5",independentCSVSource:"https://nohumans.directory/l/816d6709-3d0",readOnlySaleProof:"https://vm5-openapi-x402.onrender.com/v1/sales-proof"}
  };
  const wellKnown={
    version:1,
    resources:[endpoint,templateEndpoint,receiptEndpoint,glbEndpoint,lowpolyEndpoint,csvReportEndpoint,csvPreflightEndpoint,x402QuoteEndpoint,emailDnsEndpoint,httpsCertEndpoint],
    instructions:"New $0.005 HTTPS certificate trust/expiry preflight GET /v1/https-cert-preflight and free fictional /v1/tls-certificate-sample, only bounded public IPv4 pinned TLS, no HTTP/SMTP and NO verified paid orders yet. New 0.005 Base native CircleUSDC public email DNS MX/SPF/DMARC check GET /v1/email-dns-preflight and free illustrative /v1/email-dns-sample; no verified buyer for this new route, DNS errors before charging. New 0.01 Base native CircleUSDC GET /v1/x402-preflight reviews public unsigned x402 v2 402 quotes without network fetch or signed data; free GET /v1/x402-sample, source original same-owner VM3 adapted by VM5. Buyer demand for CSV structural preflight observed in public NoHumans search logs. New 0.005 Base native USDC GET /v1/csv-report returns one full reproducible synthetic anomaly pack, POST /v1/csv-preflight audits <=32KB buyer CSV in memory. Invalid inputs rejected BEFORE charge. Paid GET /v1/generate-lowpoly generates an AI-assisted as-is non-exclusive original GLB binary for 0.05 Base Circle USDC, default lantern seed0. POST /v1/analyze-glb reviews GLB metadata for 0.01USDC. GET /v1/x402-template serves an API starter 0.01USDC, POST /v1/lint analyzes OpenAPI 0.01USDC, GET /v1/base-usdc-receipt verifies a public Base native Circle USDC Transfer 0.005USDC. Inputs validated before any charge. GET /v1/lowpoly-sample and /v1/glb-sample free. AI-assisted source public, no exclusive IP claim. Two historic separate paid template and CSV receipts total 0.015 native BaseUSDC from the SAME NoHumans automated scout; no additional new route sales proven.",
    claim:"Discovery is NOT payment. Two separately settled and delivered actual native BaseUSDC x402 receipts: template 0.01 and CSV 0.005 to SAME external NoHumans scout on 2026-10-19. See free GET /v1/sales-proof; all remaining routes including email DNS have zero confirmed buyer purchases."
  };
  return {spec,wellKnown};
}
