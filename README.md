# VM5 x402 OpenAPI Lint — paid API pilot

AI-agent-callable OpenAPI documentation lint: **0.02 USDC per valid lint invocation** on Base (chain 8453), using x402 v2. Runs Redocly 2.64.1 recommended rules against YAML/JSON and returns structured severities, rule IDs, JSON pointers, messages, error/warning counts and an overall lint validity flag.

**Launch status:** A real unauthenticated HTTP 402 challenge has been verified and 15 automated tests pass. **No real USDC payment or on-chain settlement has been performed by this project yet.** Receipt and revenue remain zero until proven on-chain. An HTTP 402 proves only the quotation layer.

## Free sample and paid call

- GET /health — public readiness, no charge
- GET /v1/docs — API contract, recipient, external facilitator, limits and privacy
- GET /v1/sample — full public sample report, 0 errors and 2 transparently disclosed advisory warnings, free
- POST /v1/lint — paid x402 0.02 USDC per request. JSON envelope contains a spec string (64,000 UTF-8 bytes max) with an OpenAPI 3.x YAML/JSON document.

Resolve the **live API URL** from https://livastic-vm5-primary-20260911.github.io/x402-openapi-lint/live.json (Cloudflare Quick Tunnel host can change). Use an x402 v2 client to POST {"spec":"openapi: 3.0.3\ninfo: {title: Example, version: '1'}\npaths: {}"} with Content-Type application/json. The first request gets HTTP 402 with Base USDC address 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913, amount 20000 atomic units, and payTo receiver 0x6b01efA0705E91a7aca54271510bf9e594717f34.

A buyer who accepts the amount signs an EIP-3009 authorization in its **own** wallet and resends the request with PAYMENT-SIGNATURE. The service delegates verification and settlement to https://facilitator.openx402.ai; VM5 does not receive or use the buyer's private key.

Successful paid invocation returns a Redocly findings report. Bad YAML, external references, oversized input and invalid JSON envelope get 400 or 413 **before** reaching the paywall. A syntactically valid but low-quality OpenAPI specification may yield Redocly lint errors; documenting those defects is the service being sold. No secret specs or confidential data should be submitted.

## Run and test

Requires Node 22+. From this directory:

    npm ci --no-audit --no-fund
    PORT=8736 npm start

Test unauthenticated quote (no money sent):

    curl http://127.0.0.1:8736/v1/sample
    curl -i -X POST http://127.0.0.1:8736/v1/lint -H 'Content-Type: application/json' -d '{"spec":"openapi: 3.0.3\ninfo: {title: Demo, version: \"1\"}\npaths: {}"}'

Full offline test with mock facilitator, no keys or USDC spent:

    npm test

Latest VM5 result: 15 tests passed, 0 failed. npm audit --omit=dev reported zero vulnerabilities at the same time; this is not a guarantee against future advisories.

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
