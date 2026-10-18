#!/usr/bin/env python3
"""VM5 safe original x402 HTTPS quote readiness. No wallet, API keys, or paid calls.

Verifies the LIVE public server is the current original merchant and that the
published priced template cannot silently regress to an unpayable HTTP404.
This is NOT proof of buyer funding, settled USDC, delivery, or merchant income.
"""
import base64
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

TOKEN = "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913"
RECIPIENT = "0x6b01efA0705E91a7aca54271510bf9e594717f34"
ORIGIN = re.compile(r"^https://[a-z0-9-]+\.trycloudflare\.com$")

def check_payload(data, expected_origin):
    if not isinstance(data, dict) or data.get("x402Version") != 2:
        raise ValueError("wrong x402 version")
    resource = data.get("resource") or {}
    if resource.get("url") != expected_origin + "/v1/x402-template":
        raise ValueError("wrong paid resource")
    accepts = data.get("accepts") or []
    if not isinstance(accepts, list) or len(accepts) != 1:
        raise ValueError("wrong payment choices")
    pay = accepts[0]
    if (pay.get("scheme") != "exact"
        or pay.get("network") != "eip155:8453"
        or str(pay.get("asset") or "").lower() != TOKEN.lower()
        or str(pay.get("payTo") or "").lower() != RECIPIENT.lower()
        or pay.get("amount") != "10000"):
        raise ValueError("wrong merchant, price, asset or network")
    return True

def get(endpoint):
    request = urllib.request.Request(endpoint, headers={
        "Accept": "application/json",
        "User-Agent": "VM5-existing-x402-public-readiness-unpaid/1.0",
    }, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=13) as response:
            return response.status, response.read(13000), response.headers, response.geturl()
    except urllib.error.HTTPError as error:
        return error.code, error.read(13000), error.headers, error.geturl()

def verify(origin):
    if not ORIGIN.fullmatch(origin):
        raise ValueError("public origin is not the authorized Quick Tunnel form")
    status, body, headers, final_url = get(origin + "/health")
    if status != 200 or final_url != origin + "/health":
        raise ValueError("merchant public health offline")
    health = json.loads(body)
    if health.get("service") != "vm5-openapi-x402" or health.get("ok") is not True:
        raise ValueError("wrong public application")
    status, body, headers, final_url = get(origin + "/v1/x402-template")
    if status != 402 or final_url != origin + "/v1/x402-template":
        raise ValueError("paid template not returning 402")
    quoted = json.loads(body)
    check_payload(quoted, origin)
    encoded = headers.get("payment-required")
    if not isinstance(encoded, str) or len(encoded) > 16000:
        raise ValueError("missing bounded signed-payment instructions")
    canonical = json.loads(base64.b64decode(encoded, validate=True))
    check_payload(canonical, origin)
    if canonical != quoted:
        raise ValueError("payment header/body mismatch")
    status, body, headers, final_url = get(origin + "/v1/base-usdc-receipt")
    if status != 400 or final_url != origin + "/v1/base-usdc-receipt":
        raise ValueError("bad receipt input should be unpaid400, not404")
    body = json.loads(body)
    if body.get("charged") is not False:
        raise ValueError("invalid receipt query may not request payment")
    return {"publicOriginVerified": True, "httpHealth": 200,
            "paidTemplateCorrectX402": 402, "malformedReceiptUnpaid": 400,
            "network": "eip155:8453", "sellerAmountAtomicUSDC": "10000",
            "ownerReceivesAnyUSDCProvenByThisTest": False,
            "noWalletOrPaymentSignatureAccess": True}

def selftest():
    origin = "https://example.trycloudflare.com"
    good = {"x402Version": 2,
            "resource": {"url": origin + "/v1/x402-template"},
            "accepts": [{"scheme": "exact", "network": "eip155:8453",
                         "asset": TOKEN, "payTo": RECIPIENT, "amount": "10000"}]}
    assert check_payload(good, origin)
    for field, altered in (("payTo", "0x"+"ff"*20), ("amount", "20000"),
                           ("network", "eip155:84532"), ("asset", "0x"+"ab"*20)):
        clone = json.loads(json.dumps(good))
        clone["accepts"][0][field] = altered
        try: check_payload(clone, origin)
        except ValueError: pass
        else: raise AssertionError("accepted incorrect " + field)
    try: check_payload(good, "https://different.trycloudflare.com")
    except ValueError: pass
    else: raise AssertionError("accepted host mismatch")
    assert not ORIGIN.fullmatch("http://127.0.0.1")
    print(json.dumps({"readinessUnitTests": "PASS", "cases": 7}))

if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--selftest"]:
            selftest()
        elif len(sys.argv) == 2:
            print(json.dumps(verify(sys.argv[1]), ensure_ascii=False))
        else:
            raise ValueError("expected one public Quick Tunnel origin")
    except Exception as error:
        print(json.dumps({"publicPaidRouteReady": False,
                          "failureType": type(error).__name__,
                          "message": str(error)[:180]}), file=sys.stderr)
        raise SystemExit(1)
