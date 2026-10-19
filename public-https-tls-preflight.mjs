// Original VM2 isolated contribution to the ONE-OWNER VM5 hosted paid API.
// Public domains and public TLS certificate metadata only. No HTTP, SMTP,
// wallet, auth, private IP connection, third-party personal data, or crawler.
import tls from "node:tls";
import dns from "node:dns/promises";
import {isIP} from "node:net";
import {validatePublicDomain} from "./email-dns-preflight.mjs";

const TIMEOUT_MS=3800;

export function isPublicIPv4(raw){
  if(typeof raw!=="string"||isIP(raw)!==4)return false;
  const [a,b,c,d]=raw.split(".").map(Number);
  if(a===0||a===10||a===127||a>=224)return false;
  if(a===100&&b>=64&&b<=127)return false;
  if(a===169&&b===254)return false;
  if(a===172&&b>=16&&b<=31)return false;
  if(a===192&&(b===0||b===168||(b===88&&c===99)))return false;
  if(a===198&&(b===18||b===19||(b===51&&c===100)))return false;
  if(a===203&&b===0&&c===113)return false;
  if(a===255&&b===255&&c===255&&d===255)return false;
  return true;
}

function safeName(value){
  return typeof value==="string"?value.slice(0,160):null;
}

// A pinned PUBLIC IPv4 address prevents DNS rebinding after the public DNS
// preflight. A non-verifying TLS handshake is used ONLY to READ certificate
// metadata on broken public certificates; the report must clearly say whether
// the chain was actually authorized. Never send application-level HTTP bytes.
export function probePublicTls(domain,ip){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const sock=tls.connect({
      host:ip,port:443,servername:domain,
      rejectUnauthorized:false,minVersion:"TLSv1.2",
      timeout:TIMEOUT_MS,
    });
    function fail(){
      if(settled)return;
      settled=true;sock.destroy();reject(new Error("TLS_PROBE_UNAVAILABLE"));
    }
    sock.on("timeout",fail);
    sock.on("error",fail);
    sock.once("secureConnect",()=>{
      if(settled)return;
      settled=true;
      try{
        const cert=sock.getPeerCertificate(false);
        if(!cert||typeof cert.valid_to!=="string")throw Error("Invalid certificate");
        resolve({
          validFrom:cert.valid_from,
          validTo:cert.valid_to,
          commonName:safeName(cert.subject?.CN),
          issuerCommonName:safeName(cert.issuer?.CN),
          fingerprint256:safeName(cert.fingerprint256),
          hostnameMatches:!tls.checkServerIdentity(domain,cert),
          chainAuthorized:sock.authorized===true,
          // Only stable sanitized OpenSSL identifier, never raw network text.
          authorizationError:safeName(String(sock.authorizationError||"NONE").replace(/[^A-Z0-9_]/g,"_")),
          protocol:safeName(sock.getProtocol()),
        });
      }catch{reject(new Error("TLS_CERT_UNAVAILABLE"));}
      finally{sock.end();sock.destroy();}
    });
  });
}

export async function inspectPublicTlsCertificate(raw,{
  resolve4=dns.resolve4,probe=probePublicTls,now=()=>new Date(),dnsTimeoutMs=TIMEOUT_MS
}={}){
  const v=validatePublicDomain(raw);
  if(!v.ok)return {ok:false,error:v.error};
  const domain=v.domain;
  let ips, timer;
  try{
    // DNS cannot hold the expensive public TLS preflight open indefinitely.
    ips=await Promise.race([
      resolve4(domain),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("DNS_TIMEOUT")),dnsTimeoutMs);})
    ]);
  }catch{return {ok:false,error:"PUBLIC_DNS_UNAVAILABLE"};}
  finally{clearTimeout(timer);}
  if(!Array.isArray(ips)||ips.length===0||ips.length>8||
     ips.some(x=>!isPublicIPv4(x)))return {ok:false,error:"NO_EXCLUSIVELY_PUBLIC_IPV4"};
  let cert;
  try{cert=await probe(domain,ips[0]);}
  catch{return {ok:false,error:"PUBLIC_TLS_CERT_UNAVAILABLE"};}
  const start=Date.parse(cert?.validFrom);
  const end=Date.parse(cert?.validTo);
  const current=now();
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||
     !(current instanceof Date)||!Number.isFinite(current.getTime()))
    return {ok:false,error:"CERTIFICATE_DATES_NOT_AVAILABLE"};
  const daysRemaining=Math.floor((end-current.getTime())/86400000);
  return {
    ok:true,kind:"public_https_certificate_preflight",
    domain,inspectedAtUTC:current.toISOString(),port:443,
    certificateValidFromUTC:new Date(start).toISOString(),
    certificateExpiresAtUTC:new Date(end).toISOString(),
    daysUntilExpiry:daysRemaining,expired:end<=current.getTime(),
    notYetValid:start>current.getTime(),
    chainAuthorized:cert.chainAuthorized===true,
    hostnameMatches:cert.hostnameMatches===true,
    commonName:safeName(cert.commonName),
    issuerCommonName:safeName(cert.issuerCommonName),
    fingerprint256:safeName(cert.fingerprint256),
    protocol:safeName(cert.protocol),
    // Do not guarantee acceptance by all clients, CT logs, revocation or
    // server HTTP reachability, nor assert domain ownership or site safety.
    certificateTrustAndHostnameVerified:cert.chainAuthorized===true&&
      cert.hostnameMatches===true&&end>current.getTime()&&start<=current.getTime(),
    readOnlyPublicCertificateOnly:true,httpRequestsSent:0,
    didNotValidateRevocationOrCT:true,credentialsCollected:false,
    anyRealCustomerPaymentsProvenForThisEndpoint:0
  };
}
