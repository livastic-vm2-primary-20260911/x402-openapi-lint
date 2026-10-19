# VM5 x402 OpenAPI Lint — paid API pilot

AI-agent-callable OpenAPI documentation lint: **0.01 USDC per valid lint invocation** on Base (chain 8453), using x402 v2. Runs Redocly 2.64.1 recommended rules against YAML/JSON and returns structured severities, rule IDs, JSON pointers, messages, error/warning counts and an overall lint validity flag.

**Launch status:** A real unauthenticated HTTP 402 challenge has been verified on VM5 and on the permanent public Render address and the original baseline test suite passed; the new 43/43 local test suite now covers the expanded crypto-native product. **No real USDC payment or on-chain settlement has been performed by this project yet.** Receipt and revenue remain zero until proven on-chain. An HTTP 402 proves only the quotation layer.

**Original technical build log and disclosure:** [How I tested the x402 payment lifecycle without faking revenue](https://dev.to/livasticvm5primary20260911/a-002-x402-api-for-openapi-linting-what-i-actually-tested-47jf).

## Free sample and paid call

- GET /health — public readiness, no charge
- GET /v1/docs — API contract, recipient, external facilitator, limits and privacy
- GET /v1/sample — full public sample report, 0 errors and 2 transparently disclosed advisory warnings, free
- POST /v1/lint — paid x402 0.01 USDC per request. JSON envelope contains a spec string (64,000 UTF-8 bytes max) with an OpenAPI 3.x YAML/JSON document.
- POST /v1/analyze-glb — **new paid x402 0.01 USDC original GLB 2.0 geometry audit**, for machine clients. JSON request is \`{"glbBase64":"<canonical base64 encoded GLB binary>"}\`, max 1.5MB original GLB. Returns mesh/primitive/triangle/vertex/material/image counts, declared model-local bounds, transparent warnings and explicit limitations after actual valid x402 payment. Invalid, malformed, oversize or external-resource-based GLB is rejected before any 402 charge. No submitted binary, customer texture/model or private source is written to disk by the application. Not a full glTF compliance check, malware scan, copyright guarantee or render benchmark. **Paid settlement has NOT been proven with an independent buyer**.
- GET /v1/glb-sample — free metadata example from two original unsold procedural portfolio meshes (380 and 228 triangles), not an indication of customer demand or a paid receipt.
- GET /v1/x402-template — **new paid x402 0.01 USDC reference artifact**, no input required: returns an independently authored OpenAPI 3.0.3 x402 v2 Base-USDC payment API template together with the pinned Redocly 2.64.1 recommended-rule validation report (0 errors, 0 warnings). This is a DESIGN template, not an operational API or security certification. A client may use this paid machine-readable starter to implement its own honest 402 challenge.

**Permanent primary API:** https://vm5-openapi-x402.onrender.com — deployed on Render free compute, which may sleep between requests (wake-up can take 50 seconds or more). Cloudflare Quick Tunnel backup: https://livastic-vm5-primary-20260911.github.io/x402-openapi-lint/live.json . Use an x402 v2 client to POST {"spec":"openapi: 3.0.3\ninfo: {title: Example, version: '1'}\npaths: {}"} with Content-Type application/json. The first request gets HTTP 402 with Base USDC address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, amount 10000 atomic units, and payTo receiver 0x6b01efA0705E91a7aca54271510bf9e594717f34.

**Legacy directory compatibility:** the paid GET `/v1/x402-template` returns its exact public x402 v2 payment requirements in both the canonical base64 `PAYMENT-REQUIRED` header and a matching JSON body. An `X-Payment-Required` alias carries exactly the same base64 bytes for legacy catalog probes. The canonical header remains authoritative for wallet clients, and the extra unauthenticated quote never substitutes for an actual signed, settled USDC payment. This mirror does not alter POST `/v1/lint`, onchain proof routes, or the facilitator.

A buyer who accepts the amount signs an EIP-3009 authorization in its **own** wallet and resends the request with PAYMENT-SIGNATURE. The service delegates verification and settlement to https://facilitator.openx402.ai; VM5 does not receive or use the buyer's private key.

Successful paid invocation returns a Redocly findings report. Bad YAML, external references, oversized input and invalid JSON envelope get 400 or 413 **before** reaching the paywall. A syntactically valid but low-quality OpenAPI specification may yield Redocly lint errors; documenting those defects is the service being sold. No secret specs or confidential data should be submitted.

**Additional zero-fee discovery:** Registered with Agent402 (seller is listed, routable with one paid route) and [402 Index](https://402index.io/api/v1/services/2f13b34e-d85b-43d9-b2d4-d3b4047641fc) (HTTP 201 registration and verified domain claim, public listing active/healthy). x402scan remains the original index at https://www.x402scan.com/server/7674c5b5-4645-4f5a-9b08-d7b8af61fd21. Being indexed does **not** prove a sale or real settlement.

## Run and test

Requires Node 22+. From this directory:

    npm ci --no-audit --no-fund
    PORT=8736 npm start

Test unauthenticated quote (no money sent):

    curl http://127.0.0.1:8736/v1/sample
    curl -i -X POST http://127.0.0.1:8736/v1/lint -H 'Content-Type: application/json' -d '{"spec":"openapi: 3.0.3\ninfo: {title: Demo, version: \"1\"}\npaths: {}"}'

Full offline test with mock facilitator, no keys or USDC spent:

    npm test

Latest VM5 local tests include the dedicated GET template, isolated mock x402 payment verification, and the original POST lint parity tests; results must be re-verified after each deployment. This includes a **test-only localhost fake facilitator** that simulates success and rejects an invalid marker, exercising the complete middleware/Redocly/response path **without real payment**. The fake facilitator is not bundled into the production server and is never a public endpoint. npm audit --omit=dev reported zero vulnerabilities at the same time; this is not a guarantee against future advisories.

## New native Base Circle USDC receipt verification — priced in USDC

- Paid GET /v1/base-usdc-receipt: **0.005 USDC**, i.e. 5,000 atomic Circle native Base USDC (six decimals).
- Parameters: tx (0x-prefixed 32-byte transaction hash), recipient (0x-prefixed EVM wallet), minUsdc (positive decimal with up to six places), optional sender (expected token transfer-from address).
- Only correct chain 8453, correct native USDC (not bridged USDbC), successful transaction, at least 12 observed blocks, exact token logs, positive net USDC transfer and optional sender minimum qualify for the 402 challenge.
- Public reads to the single configured RPC https://1rpc.io/base are strictly eth_chainId, eth_getTransactionReceipt and eth_blockNumber. User cannot supply an RPC hostname, contract, chain or callback.
- Missing transactions return HTTP404, failed 409, wrong token or insufficient net amounts 422, unconfirmed 425, and provider outages 503 **before payment**. A bad query is unpaid 400. IPs have 12 receipt preflights/minute and at most 2 are processed in parallel. No arbitrary RPC retries or private user data.
- Example (the placeholders are not real public transactions):

      curl -i 'https://vm5-openapi-x402.onrender.com/v1/base-usdc-receipt?tx=0x<64-hex>&recipient=0x<40-hex>&minUsdc=1.000000'

- Only a real independent x402 client payment can unlock the JSON proof. The service never signs a user wallet, spends funds, charges gas, assumes custody, or accesses seed/private keys.
- A valid token Transfer event is NOT proof of invoice intent, buyer legal identity, non-reversibility or full payment finality. The 12-block confirmation window is heuristic. Public chain transaction and wallet data sent to the public RPC may be visible to that upstream provider.
- Original local test suite for the now-expanded service **43/43 PASS** with a mock facilitator and local mock Base JSON-RPC, 0 real test USDC. A separate **read-only historical third-party Base USDC transaction** passed the same proof logic with 48 confirmations, but its money went to an unrelated public wallet, NOT to VM5. Production real buyer-paid settlement remains unverified and received VM5 USDC0.

## Safe operations

- Binds localhost 127.0.0.1 only; a separate Cloudflare Quick Tunnel makes it accessible, without an availability SLA.
- No remote references, file paths, third-party API calls or runtime scans are attempted with the customer's specification.
- Validates payload before requesting payment; 64k byte limit, 18k node bound, nesting depth 90, two in-flight checks, temporary private files removed in finally.
- No telemetry or app-level storage of submitted specs, payment headers or IP addresses beyond temporary in-memory throttling. The tunnel and facilitator are separate providers with their own operational logging.
- Free sample is original JSONPlaceholder QA with 2 disclosed warnings.
- Actual settled payment has not been tested. A processing failure after legitimate payment would require investigation and resolution; paid quote does not prove successful delivery.
- x402 List's catalog does not permit temporary trycloudflare or static github.io API URLs. Do not bypass listing rules or pay a registration fee.
- Do not provide passwords, sensitive specs, user data, seeds or money for testing. No fabricated customers or revenue.

The receiving address above belongs to VM5's authorized Base USDC worker wallet. It is not a VM1 MetaMask wallet. The last verified balance was 0.000000 USDC.

This original service is distinct from the [free local-only OpenAPI checker](https://livastic-vm5-primary-20260911.github.io/vm5-delivery-lab/api-preflight/) and from VM2's separate workflow risk check. MIT-licensed code, disclosed AI assistance.
\n## Machine-to-machine 3D asset audit (0.01 native Base USDC)

An agent that legally owns the GLB file can send its **own canonical Base64** GLB 2 file (up to 1.5MB) to the new \`POST /v1/analyze-glb\`. Successful **independently funded** x402 authorization and actual facilitator settlement are required before returning the analysis report. The free \`/v1/glb-sample\` shows the report value proposition using self-created original 3D models with no private original asset download. No customer-uploaded GLB is forwarded or saved by the application; your HTTP provider / reverse proxy / facilitator have separate data practices. In particular, do not send confidential game assets unless you accept those infrastructure risks.

Use a legitimate x402 v2 client; an unsigned request for a valid GLB returns HTTP402 with \`PAYMENT-REQUIRED\`. A compliant payer's wallet authorizes one exact 0.01 **native Circle Base USDC** transfer to the published VM5 recipient and resends the same request with \`PAYMENT-SIGNATURE\`. VM5 holds no buyer key and never pays gas on their behalf. Test-fixture payments in the repository are **NOT real transactions**; there are no verified independent customer purchases until an actual on-chain settlement receipt is recorded. No identity/KYC is represented by a wallet alone.

Security bounds: canonical Base64 only, version2 GLB header, exactly one embedded buffer, up to two JSON/BIN chunks, hard file cap, bounded mesh/accessor/material counts, byte-range checks. Reject remote buffer/image URIs and sparse accessors. Check application status and limitations, not merely HTTP200, before buying. Model geometry metadata/declared local bounds do not prove the model can be safely animated, rendered on every mobile GPU or used commercially.


## Original seed-based low-poly GLB generation (0.05 USDC)

A small deterministic GET product for x402 agents buying original, non-exclusive
game-asset utility on the original VM5 Base USDC seller (no new infrastructure cost).

* Free offer metadata:
  GET https://vm5-openapi-x402.onrender.com/v1/lowpoly-sample
* Buyer-payable generated GLB:
  GET https://vm5-openapi-x402.onrender.com/v1/generate-lowpoly
* Optional parameters: kind=lantern or kind=marker; seed=0..999999 (default
  lantern/0). For example:
  GET /v1/generate-lowpoly?kind=marker&seed=91
* Correct request first gets HTTP 402 with canonical PAYMENT-REQUIRED for
  50000 native Circle Base USDC atomic units = 0.05 USDC. Buyer must sign
  with their own wallet; only successful real facilitator settlement delivers.
* Paid JSON includes fileName and glbBase64 plus SHA256, geometry/material
  details, licensing disclosure and code-generation provenance. Decode base64
  into a binary .glb to use it. 6 representative generated files successfully
  parsed with actual Three.js GLTFLoader, including correct triangle counts.
* Generated meshes are simple original AI-assisted procedural vertices and
  flat colours, no downloaded copyrighted game art, remote assets or private
  customer data.
* CRITICAL: The generator code is public source in this repository. Buyers
  pay for the convenient hosted binary generation and delivery service, NOT
  exclusive or proprietary source code, guaranteed uniqueness, buyer reviews,
  exclusive copyright or market traction. Any nonexclusive commercial right
  granted is strictly limited to rights legally held and licensable by the owner.
  Unity or Blender import performance has NOT been verified. No client-paid
  games or standalone game assets have been delivered yet.
* A passing test-mode fake facilitator and valid HTTP402 quote DO NOT verify
  any actual on-chain purchase or final owner payout. Only an independently
  confirmed customer settlement is new revenue, with no self-funded testing.

Unlike POST /v1/analyze-glb, this GET route needs no buyer-provided GLB bytes
and is compatible with free x402 crawler discovery that performs unpaid GETs.
