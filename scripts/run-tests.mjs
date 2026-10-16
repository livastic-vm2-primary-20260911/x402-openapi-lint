import http from "node:http";
import net from "node:net";
import {spawn} from "node:child_process";
import {once} from "node:events";
import process from "node:process";

async function freePort() {
  const server=net.createServer();
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  const port=server.address().port;
  await new Promise(done=>server.close(done));
  return port;
}

const facilitator=http.createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");
  if(req.method==="GET" && req.url==="/supported"){
    res.end(JSON.stringify({
      kinds:[{x402Version:2,scheme:"exact",network:"eip155:8453",extra:{name:"USD Coin",version:"2",asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",assetTransferMethod:"eip3009"}}],
      extensions:["discovery"],signers:{"eip155:*":["0x0000000000000000000000000000000000000000"]}
    }));
  }else {res.statusCode=503;res.end(JSON.stringify({error:"Fixture cannot verify or settle payments. Testing the challenge only."}));}
});
facilitator.listen(0,"127.0.0.1");
await once(facilitator,"listening");
const port=await freePort();
const mockUrl="http://127.0.0.1:"+facilitator.address().port;
const url="http://127.0.0.1:"+port;
const env={...process.env,PORT:String(port),FACILITATOR_URL:mockUrl,NODE_ENV:"test",TEST_URL:url};
const backend=spawn(process.execPath,["server.mjs"],{cwd:new URL("../",import.meta.url),env,stdio:["ignore","pipe","pipe"]});
let backendLog="";
backend.stdout.on("data",x=>backendLog+=x.toString());
backend.stderr.on("data",x=>backendLog+=x.toString());
async function ready() {
  for(let i=0;i<65;i++){
    if(backend.exitCode!==null)throw Error("Server exited during startup: "+backendLog.slice(-900));
    try{
      const r=await fetch(url+"/health",{signal:AbortSignal.timeout(1800)});
      if(r.ok)return;
    } catch(_){}
    await new Promise(done=>setTimeout(done,250));
  }
  throw Error("Local test server failed startup: "+backendLog.slice(-1000));
}
let code=1;
try{
  await ready();
  const tests=spawn(process.execPath,["--test","tests/lint.test.mjs"],{cwd:new URL("../",import.meta.url),env,stdio:"inherit"});
  const [exit]=await once(tests,"close");
  code=exit??1;
} catch(e){console.error(e.stack||e);code=1;}
finally{
  backend.kill("SIGTERM");
  facilitator.close();
}
process.exitCode=code;
