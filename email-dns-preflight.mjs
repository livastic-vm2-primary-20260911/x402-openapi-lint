import dns from "node:dns/promises";
import {domainToASCII} from "node:url";

const ABSENT=new Set(["ENOTFOUND","ENODATA","ENOENT","ENODOMAIN","NXDOMAIN"]);
const RESERVED=new Set(["local","localhost","test","invalid","onion","internal"]);
const RETRY_MS=3000;

export function validatePublicDomain(raw) {
  if(typeof raw!=="string" || raw!==raw.trim() || raw.length<4 || raw.length>253 || /[@/:?#\\\s]/.test(raw))
    return {ok:false,error:"INVALID_DOMAIN"};
  const domain=domainToASCII(raw).toLowerCase();
  if(!domain || domain.length>253 || !/^[a-z0-9.-]+$/.test(domain))
    return {ok:false,error:"INVALID_DOMAIN"};
  const labels=domain.split(".");
  if(labels.length<2 || RESERVED.has(labels.at(-1)) || labels.at(-1).length<2 || /^[0-9]+$/.test(labels.at(-1)) ||
    labels.some(s=>s.length<1 || s.length>63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)))
    return {ok:false,error:"INVALID_PUBLIC_DNS_DOMAIN"};
  return {ok:true,domain};
}
async function readBounded(provider, method, name) {
  if(typeof provider?.[method]!=="function")throw Object.assign(new Error("Unavailable DNS resolver"),{code:"DNS_UNAVAILABLE"});
  let timer;
  try{
    const rows=await Promise.race([
      provider[method](name),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error("DNS timeout"),{code:"DNS_UNAVAILABLE"})),RETRY_MS);})
    ]);
    if(!Array.isArray(rows))throw Object.assign(new Error("Unexpected DNS response"),{code:"DNS_UNAVAILABLE"});
    return rows.slice(0,25);
  }catch(err){
    if(ABSENT.has(err?.code))return [];
    throw Object.assign(new Error("Temporary DNS lookup failure"),{code:"DNS_UNAVAILABLE"});
  }finally{clearTimeout(timer);}
}
function flattened(records) {
  return records.map(row=>Array.isArray(row)?row.join(""):"").filter(x=>typeof x==="string" && x.length>0);
}
function tag(record,key) {
  const re=new RegExp("(?:^|;)\\s*"+key+"\\s*=\\s*([^;\\s]+)","i");
  return record.match(re)?.[1]?.toLowerCase()||null;
}
export async function auditEmailDns(raw,{provider=dns,now=()=>new Date()}={}) {
  const input=validatePublicDomain(raw);
  if(!input.ok)return input;
  const domain=input.domain;
  // Public DNS only; never HTTP-connect to customer hosts or SMTP-contact mailboxes.
  // All four lookups must complete before the buyer sees a payment requirement.
  const [mx,rootTxt,dmarcTxt,a]=await Promise.all([
    readBounded(provider,"resolveMx",domain),
    readBounded(provider,"resolveTxt",domain),
    readBounded(provider,"resolveTxt","_dmarc."+domain),
    readBounded(provider,"resolve4",domain)
  ]);
  const mxHosts=mx.filter(row=>row && Number.isInteger(row.priority) && row.priority>=0 &&
    typeof row.exchange==="string" && row.exchange.length<=253)
    .map(row=>({priority:row.priority,host:row.exchange.toLowerCase().replace(/\.$/,"")}))
    .sort((a,b)=>a.priority-b.priority).slice(0,8);
  const spfList=flattened(rootTxt).filter(s=>/^v=spf1(?:\s|$)/i.test(s));
  const dmarcList=flattened(dmarcTxt).filter(s=>/^v=dmarc1(?:\s|;|$)/i.test(s));
  const dmarcPolicy=dmarcList.length===1?tag(dmarcList[0],"p"):null;
  const warnings=[];
  if(!mxHosts.length)warnings.push("NO_EXPLICIT_MX_RECORD");
  if(!spfList.length)warnings.push("NO_SPF_TXT_RECORD");
  if(spfList.length>1)warnings.push("MULTIPLE_SPF_RECORDS");
  if(!dmarcList.length)warnings.push("NO_DMARC_TXT_RECORD");
  if(dmarcList.length>1)warnings.push("MULTIPLE_DMARC_RECORDS");
  if(dmarcList.length===1 && !["none","reject","quarantine"].includes(dmarcPolicy))warnings.push("INVALID_DMARC_POLICY");
  if(dmarcPolicy==="none")warnings.push("DMARC_MONITOR_ONLY");
  if(mx.length===0 && rootTxt.length===0 && dmarcTxt.length===0 && a.length===0)
    return {ok:false,error:"DOMAIN_HAS_NO_PUBLIC_DNS_RECORDS",domain};
  return {
    ok:true,kind:"public_email_dns_preflight",domain,
    inspectedAtUTC:now().toISOString(),mxCount:mxHosts.length,mxHosts,
    hasARecord:a.length>0,
    spfPresent:spfList.length>0,spfRecordCount:spfList.length,
    spfMechanismCount:spfList.length===1?Math.max(0,spfList[0].trim().split(/\s+/).length-1):null,
    dmarcPresent:dmarcList.length>0,dmarcRecordCount:dmarcList.length,
    dmarcPolicy,dmarcPct:dmarcList.length===1?(tag(dmarcList[0],"pct")||"100"):null,
    warnings,warningCount:warnings.length,
    rawEmailAddressesReceived:false,smtpContactAttempted:false,
    limits:"Read-only bounded DNS MX, SPF TXT, DMARC TXT and A; no mailbox/SMTP check, no DKIM selector audit, no deliverability or security guarantee."
  };
}
