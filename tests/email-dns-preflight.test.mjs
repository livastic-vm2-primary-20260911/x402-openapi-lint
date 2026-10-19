import test from "node:test";
import assert from "node:assert/strict";
import {validatePublicDomain,auditEmailDns} from "../email-dns-preflight.mjs";

test("domain guard blocks addresses, URLs, private/reserved and injection strings before DNS",()=>{
 for(const d of ["","a","example.local","localhost","127.0.0.1","one","hello@test.org","https://google.com","a/b.com","a\n.com","-x.com","x-.com","test..org","example.invalid","wow.org/../../etc/passwd",{},null,["x.com"]]){
   assert.equal(validatePublicDomain(d).ok,false,String(d));
 }
 assert.deepEqual(validatePublicDomain("GMAIL.COM"),{ok:true,domain:"gmail.com"});
 assert.deepEqual(validatePublicDomain("bücher.de"),{ok:true,domain:"xn--bcher-kva.de"});
});
const records={
 resolveMx:async()=>[{priority:10,exchange:"mail.example.org."}],
 resolve4:async()=>["93.184.215.14"],
 resolveTxt:async name=>name.startsWith("_dmarc.")?[["v=DMARC1; p=reject; pct=100"]]:[["v=spf1 include:_spf.example.org -all"]]
};
test("configured public DNS audit is deterministic and explains limitations",async()=>{
 const r=await auditEmailDns("example.org",{provider:records,now:()=>new Date("2026-10-19T14:20:00Z")});
 assert.equal(r.ok,true);assert.equal(r.mxCount,1);
 assert.equal(r.mxHosts[0].host,"mail.example.org");
 assert.equal(r.spfPresent,true);assert.equal(r.dmarcPolicy,"reject");
 assert.equal(r.warningCount,0);
 assert.equal(r.inspectedAtUTC,"2026-10-19T14:20:00.000Z");
 assert.equal(r.smtpContactAttempted,false);
});
test("missing MX/SPF/DMARC are warnings, no promise of deliverability",async()=>{
 const provider={resolveMx:async()=>[],resolve4:async()=>["8.8.8.8"],resolveTxt:async()=>[]};
 const r=await auditEmailDns("a.testdomain.com",{provider});
 assert.equal(r.ok,true);assert.equal(r.warningCount,3);
 assert.ok(r.warnings.includes("NO_EXPLICIT_MX_RECORD"));
});
test("NXDOMAIN and resolver failure do not yield an invoiceable product",async()=>{
 const absent={resolveMx:async()=>{const e=Error("not found");e.code="ENODATA";throw e;},resolveTxt:async()=>[],resolve4:async()=>[]};
 const missing=await auditEmailDns("missing.example.org",{provider:absent});
 assert.equal(missing.ok,false);assert.equal(missing.error,"DOMAIN_HAS_NO_PUBLIC_DNS_RECORDS");
 const failure={...records,resolve4:async()=>{throw Object.assign(Error("servfail"),{code:"SERVFAIL"});}};
 await assert.rejects(()=>auditEmailDns("example.org",{provider:failure}),{code:"DNS_UNAVAILABLE"});
});

