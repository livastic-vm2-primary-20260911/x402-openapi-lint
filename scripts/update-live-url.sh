#!/usr/bin/env bash
# Keep the permanent x402 Github Pages pointer aligned with the active Quick Tunnel.
# Only public URL and timestamp are committed; never read credentials or payment secrets.
set -euo pipefail
cd /srv/multi-vm-agent/workspace/make_money/work/x402-openapi-lint
LIVE="$(sudo -n journalctl -u vm5-x402-tunnel.service -n 110 --no-pager --output=cat 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -n1)"
[[ "$LIVE" =~ ^https://[a-z0-9-]+\.trycloudflare\.com$ ]] || { echo "Quick Tunnel hostname missing"; exit 1; }
HEALTH="$(curl -fsSL --connect-timeout 6 --max-time 12 "$LIVE/health")"
printf '%s' "$HEALTH" | grep -q '"service":"vm5-openapi-x402"' || { echo "Current tunnel does not serve the expected application"; exit 2; }
python3 - "$LIVE" <<'PY'
import json,sys,pathlib,datetime
p=pathlib.Path("docs/live.json")
old=json.loads(p.read_text()) if p.exists() else {}
url=sys.argv[1]
if old.get("apiBase")==url and old.get("status")=="reachable":
 print("Live pointer unchanged.")
 raise SystemExit(0)
new={"apiBase":url,"status":"reachable","checkedAtUTC":datetime.datetime.now(datetime.timezone.utc).isoformat(),"note":"x402 payment signature and settlement are not live-verified"}
p.write_text(json.dumps(new,indent=2)+"\n")
print("Published URL pointer:",url)
PY
if ! git diff --quiet -- docs/live.json; then
  git add docs/live.json
  git commit -m 'Sync public OpenAPI x402 pilot tunnel hostname'
  git push origin main
fi
