import test from "node:test";
import assert from "node:assert/strict";
import {isPublicIPv4,inspectPublicTlsCertificate} from "../public-https-tls-preflight.mjs";
const NOW=new Date("2026-10-20T00:00:00Z");
const fake={validFrom:"Oct 1 00:00:00 2026 GMT",validTo:"Nov 1 00:00:00 2026 GMT",
  chainAuthorized:true,hostnameMatches:true,commonName:"example.com",
  issuerCommonName:"Fictional Public CA",fingerprint256:"00:AA",protocol:"TLSv1.3"};
const provider={resolve4:async()=>["93.184.216.34"],probe:async()=>fake,now:()=>NOW};

test("strictly excludes localhost, cloud metadata, carrier-grade NAT, private, doc ranges and IPv6",()=>{
  for(const ip of ["127.0.0.1","0.0.0.0","10.1.2.3","172.16.0.1",
      "172.31.255.255","192.168.1.1","169.254.169.254","100.64.1.2",
      "100.127.255.255","192.0.2.1","192.0.0.8","198.18.0.1",
      "198.51.100.2","203.0.113.3","224.0.0.1","255.255.255.255",
      "::1","fe80::1","not an ip","8.8.8.8:444"]){
    assert.equal(isPublicIPv4(ip),false,ip);
  }
  for(const ip of ["93.184.216.34","1.1.1.1","8.8.8.8","172.32.0.1"])
    assert.equal(isPublicIPv4(ip),true,ip);
});

test("public domain parser rejects SSRF primitives and URL/userinfo",async()=>{
  for(const raw of ["localhost","127.0.0.1","example.local",
      "https://example.com","example.com:8443","user@example.com",
      "example.com/foo","example.com\nX-Foo:bar","example.invalid",{},
      null,["example.com"]]){
    const r=await inspectPublicTlsCertificate(raw,provider);
    assert.equal(r.ok,false,String(raw));
  }
});

test("a domain resolving to any private/mixed/IPv6 IP cannot be connected to",async()=>{
  for(const ips of [
    ["169.254.169.254"],["8.8.8.8","10.0.0.1"],["::1"],[],
    Array.from({length:9},()=> "8.8.8.8")
  ]){
    let dialed=false;
    const r=await inspectPublicTlsCertificate("example.com",{...provider,
      resolve4:async()=>ips,
      probe:async()=>{dialed=true;return fake;}
    });
    assert.equal(r.ok,false,JSON.stringify(ips));
    assert.equal(dialed,false);
  }
});

test("probes exact domain and PINNED verified public IPv4, not rebinding resolution",async()=>{
  const seen=[];
  const x=await inspectPublicTlsCertificate("EXAMPLE.COM",{...provider,
    probe:async(d,ip)=>{seen.push([d,ip]);return fake;}
  });
  assert.equal(x.ok,true);
  assert.deepEqual(seen,[["example.com","93.184.216.34"]]);
  assert.equal(x.certificateTrustAndHostnameVerified,true);
  assert.equal(x.port,443);
  assert.equal(x.daysUntilExpiry,12);
  assert.equal(x.readOnlyPublicCertificateOnly,true);
  assert.equal(x.httpRequestsSent,0);
  assert.equal(x.anyRealCustomerPaymentsProvenForThisEndpoint,0);
});

test("expired certificate is honestly reported, not incorrectly trusted",async()=>{
  const a=await inspectPublicTlsCertificate("example.com",{...provider,probe:async()=>({...fake,validTo:"Sep 30 00:00:00 2026 GMT"})});
  // Expiry before not-before is malformed: no claim, no invoice.
  assert.equal(a.ok,false);
  const b=await inspectPublicTlsCertificate("example.com",{...provider,probe:async()=>({...fake,
    validFrom:"Jan 1 00:00:00 2026 GMT",validTo:"Oct 1 00:00:00 2026 GMT"})});
  assert.equal(b.ok,true);
  assert.equal(b.expired,true);
  assert.equal(b.certificateTrustAndHostnameVerified,false);
});

test("hostname mismatch and untrusted CA are not interpreted as verified",async()=>{
  for(const override of [{hostnameMatches:false},{chainAuthorized:false},{hostnameMatches:false,chainAuthorized:false}]){
    const r=await inspectPublicTlsCertificate("example.com",{...provider,probe:async()=>({...fake,...override})});
    assert.equal(r.ok,true);
    assert.equal(r.certificateTrustAndHostnameVerified,false);
  }
});

test("unavailable DNS, timeout or missing certificate fails BEFORE payment",async()=>{
  const missing=await inspectPublicTlsCertificate("example.com",{...provider,resolve4:async()=>{throw Error("Network");}});
  assert.equal(missing.ok,false);
  const timeout=await inspectPublicTlsCertificate("example.com",{...provider,probe:async()=>{throw Error("Timeout");}});
  assert.equal(timeout.error,"PUBLIC_TLS_CERT_UNAVAILABLE");
  const certless=await inspectPublicTlsCertificate("example.com",{...provider,probe:async()=>({})});
  assert.equal(certless.error,"CERTIFICATE_DATES_NOT_AVAILABLE");
});

test("no added private material or external customer certificate stored",async()=>{
  const x=await inspectPublicTlsCertificate("example.com",provider);
  assert.equal(x.credentialsCollected,false);
  assert.equal(x.didNotValidateRevocationOrCT,true);
  assert.equal(JSON.stringify(x).includes("secret"),false);
});
