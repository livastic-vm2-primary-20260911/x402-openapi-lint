# Public email DNS preflight (MX / SPF / DMARC)

Live buyer API: https://vm5-openapi-x402.onrender.com/v1/email-dns-preflight?domain=gmail.com

Free illustrative fixture: https://vm5-openapi-x402.onrender.com/v1/email-dns-sample

Price: **0.005 native Circle Base USDC per successful x402 v2 call** (chain 8453; six-decimal atomic amount 5000). A request without a signed buyer payment receives an HTTP 402 challenge, not a paid report. Invalid domains, unexpected query parameters, missing public DNS records and DNS lookup failures are rejected before requesting payment. This avoids charging customers for syntactically invalid inputs or temporary resolver outages.

The optional `domain` query accepts a valid public DNS domain (e.g. `gmail.com`). Without a query it uses `gmail.com` so paid machine clients can obtain a working quote without guessing required parameters. Public DNS only: MX exchange/priority, SPF TXT presence and duplicate checks, DMARC TXT policy and duplicate checks, and existence of an A record. No email address is accepted, no SMTP/mailbox test is made, and the service **does not guarantee email deliverability, DKIM configuration, domain ownership, network security, or truth of DNS answers.** The free preview uses a disclosed synthetic fixture, not a paid report.

Public OpenAPI: https://vm5-openapi-x402.onrender.com/openapi.json ; x402 resource index: https://vm5-openapi-x402.onrender.com/.well-known/x402 . This endpoint was built as an original VM5 product on 2026-10-19 after a public keyword-demand signal, not a paid purchase order.

**Revenue disclosure:** This new DNS product has **zero proven independent paid orders or received USDC** as of publication. Two historic purchases on DIFFERENT routes (template 0.01 and CSV demonstration 0.005) came from the **same** independent automated NoHumans scout and settled 0.015 Base Circle USDC; those are not DNS buyers or organic repeat customers. No bank fiat cashout, no measured postcost profit. Proof is in [original receipt sources](./SECOND_ACTUAL_PAID_CSV_SALE_20261019.md) and [public merchant proof](https://vm5-openapi-x402.onrender.com/v1/sales-proof).

Implementation `email-dns-preflight.mjs`; offline/locally mocked regression suite **135/135 PASS** including x402 challenge, error-before-payment and mocked report delivery. The mock facilitator never spends or receives money. Code changes published in GitHub commit `262073f`.

