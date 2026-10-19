import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CHAIN_ID,BASE_USDC,ERC20_TRANSFER_TOPIC,
  toUSDCAtomic,fromUSDCAtomic,validateReceiptQuery,analyzeReceipt,
  preflightBaseUSDCReceipt,baseRpcRead
} from "../base-usdc-receipt.mjs";

const base=process.env.TEST_URL||"http://127.0.0.1:8736";
const tx="0x"+"aa".repeat(32);
const from="0x"+"33".repeat(20);
const to="0x"+"44".repeat(20);
const stranger="0x"+"55".repeat(20);
const topicAddr=a=>"0x"+a.slice(2).padStart(64,"0");
const log=(owner,sender,recipient,amount)=>({
  address:owner,
  topics:[ERC20_TRANSFER_TOPIC,topicAddr(sender),topicAddr(recipient)],
  data:"0x"+BigInt(amount).toString(16).padStart(64,"0")
});
const params=(more={})=>({txHash:tx,recipient:to,sender:null,minAtomic:1_000_000n,...more});
const receipt=(logs=[log(BASE_USDC,from,to,4_000_000n)],more={})=>({
  transactionHash:tx,status:"0x1",blockNumber:"0x100",logs,...more
});
const livePath=(hash=tx,recipient=to,minimum="3",sender)=> {
  const q=new URLSearchParams({tx:hash,recipient,minUsdc:minimum});
  if(sender)q.set("sender",sender);
  return base+"/v1/base-usdc-receipt?"+q.toString();
};

test("Circle official Base network, six-decimal rule and zero-spend fixed RPC",()=>{
 assert.equal(BASE_CHAIN_ID,8453);
 assert.equal(BASE_USDC.toLowerCase(),"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
 assert.equal(toUSDCAtomic("0.000001"),1n);
 assert.equal(toUSDCAtomic("4.123456"),4_123_456n);
 assert.equal(fromUSDCAtomic(4_123_456n),"4.123456");
 for(const x of ["0","0.000000","4.1234567","-1","NaN","0.1e3","001.0","1."]){
  assert.throws(()=>toUSDCAtomic(x),x);
 }
});

test("RPC rejects attempts to send, sign, use other networks or retrieve arbitrary account data",async()=>{
 for(const method of ["eth_sendTransaction","eth_sendRawTransaction","eth_sign","eth_getBalance","eth_call","wallet_sendTransaction"]){
   await assert.rejects(()=>baseRpcRead(method,[]),/Refusing/);
 }
 await assert.rejects(()=>baseRpcRead("eth_chainId",[],{rpcUrl:"https://evil.example.com"}),/Untrusted/);
});

test("Pure query validator rejects missing, duplicate, malformed hash/wallet, float threshold, unknown fields",()=>{
 assert.equal(validateReceiptQuery({tx,recipient:to,minUsdc:"1"}).ok,true);
 for(const input of [
  null,{tx:"0x11",recipient:to,minUsdc:"1"},
  {tx,recipient:"not-a-wallet",minUsdc:"1"},
  {tx,recipient:to,minUsdc:"0.000000"},
  {tx,recipient:to,minUsdc:"0.0000001"},
  {tx,recipient:to,minUsdc:"1",customRpc:"https://evil.invalid"},
  {tx:[tx,tx],recipient:to,minUsdc:"1"},
  {tx,recipient:to,minUsdc:"1",sender:"not-a-sender"}
 ])assert.equal(validateReceiptQuery(input).ok,false,JSON.stringify(input));
});

test("Public pure USDC proof requires successful transaction, native token and net recipient increase",()=>{
 const verified=analyzeReceipt(receipt(),"0x111",params());
 assert.equal(verified.ok,true);
 assert.equal(verified.proof.netIncomingAtomic,"4000000");
 assert.equal(verified.proof.netIncomingUSDC,"4.000000");
 assert.equal(verified.proof.confirmations,"18");
 assert.equal(verified.proof.chainId,8453);
 assert.equal(verified.proof.expectedSender,null);
 assert.match(verified.proof.caveat,/invoice intent/);
});

test("Read-only proof can enforce external payer sender and minimum threshold",()=>{
 assert.equal(analyzeReceipt(receipt(),"0x111",params({sender:from,minAtomic:4_000_000n})).ok,true);
 assert.equal(analyzeReceipt(receipt(),"0x111",params({sender:stranger,minAtomic:1n})).httpStatus,422);
 assert.equal(analyzeReceipt(receipt(),"0x111",params({minAtomic:4_000_001n})).httpStatus,422);
});

test("Forged lookalike USDbC token cannot be called native Circle USDC",()=>{
 const b=receipt([log("0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",from,to,4_000_000n)]);
 assert.equal(analyzeReceipt(b,"0x111",params()).httpStatus,422);
});

test("No net payment when sender self-transfers or receives and spends",()=>{
 let b=receipt([log(BASE_USDC,to,to,4_000_000n)]);
 assert.equal(analyzeReceipt(b,"0x111",params()).httpStatus,422);
 b=receipt([log(BASE_USDC,from,to,4_000_000n),log(BASE_USDC,to,stranger,4_000_000n)]);
 assert.equal(analyzeReceipt(b,"0x111",params()).httpStatus,422);
 b=receipt([log(BASE_USDC,from,to,4_000_000n),log(BASE_USDC,to,stranger,3_000_000n)]);
 assert.equal(analyzeReceipt(b,"0x111",params({minAtomic:2_000_000n})).httpStatus,422);
});

test("Mint event from zero is NOT independent external customer payment",()=>{
 const b=receipt([log(BASE_USDC,"0x"+"00".repeat(20),to,8_000_000n)]);
 assert.equal(analyzeReceipt(b,"0x111",params()).httpStatus,422);
});

test("Failed, non-existent and insufficiently confirmed receipts never reach paid handler",()=>{
 assert.equal(analyzeReceipt(null,"0x111",params()).httpStatus,404);
 assert.equal(analyzeReceipt(receipt([],{status:"0x0"}),"0x111",params()).httpStatus,409);
 assert.equal(analyzeReceipt(receipt(),"0x104",params()).httpStatus,425);
});
test("Tampered tx hash, future block, malformed native USDC log fail closed",()=>{
 assert.throws(()=>analyzeReceipt(receipt([],{transactionHash:"0x"+"bb".repeat(32)}),"0x111",params()),/mismatch/);
 assert.throws(()=>analyzeReceipt(receipt(),"0xff",params()),/precedes/);
 const bad=receipt([{...log(BASE_USDC,from,to,4_000_000n),data:"0xnot-hex"}]);
 assert.throws(()=>analyzeReceipt(bad,"0x111",params()),/Malformed/);
});
test("Preflight authenticates expected chain before reading a transaction",async()=>{
 const calls=[];
 await assert.rejects(()=>preflightBaseUSDCReceipt(params(),async(method)=>{
  calls.push(method);
  return "0x1";
 }),/switched chains/);
 assert.deepEqual(calls,["eth_chainId"]);
});

test("Bad query pre-validation is unpaid HTTP400, no payment challenge",async()=>{
 const r=await fetch(livePath(tx,to,"0.0000001"));
 assert.equal(r.status,400);
 assert.equal(r.headers.get("payment-required"),null);
 const j=await r.json();
 assert.equal(j.charged,false);
});

test("Non-existent chain receipt is unpaid HTTP404",async()=>{
 const r=await fetch(livePath("0x"+"bb".repeat(32)));
 assert.equal(r.status,404);
 assert.equal(r.headers.get("payment-required"),null);
 assert.equal((await r.json()).charged,false);
});
test("Failed Base transaction is unpaid HTTP409",async()=>{
 const r=await fetch(livePath("0x"+"cc".repeat(32)));
 assert.equal(r.status,409);
 assert.equal((await r.json()).charged,false);
});
test("Insufficient or spoofed bridged token USDC is unpaid HTTP422",async()=>{
 const r=await fetch(livePath("0x"+"dd".repeat(32)));
 assert.equal(r.status,422);
 assert.equal(r.headers.get("payment-required"),null);
});
test("Unconfirmed Base USDC transaction is unpaid HTTP425",async()=>{
 const r=await fetch(livePath("0x"+"ee".repeat(32)));
 assert.equal(r.status,425);
 assert.equal(r.headers.get("payment-required"),null);
});
test("Matching Base native Circle USDC transaction reaches 0.005 x402 payment wall",async()=>{
 const r=await fetch(livePath());
 assert.equal(r.status,402);
 const encoded=r.headers.get("payment-required");
 assert.ok(encoded);
 const q=JSON.parse(Buffer.from(encoded,"base64").toString());
 assert.equal(q.x402Version,2);
 assert.equal(q.accepts.length,1);
 assert.equal(q.accepts[0].network,"eip155:8453");
 assert.equal(q.accepts[0].amount,"5000");
 assert.equal(q.accepts[0].payTo.toLowerCase(),"0x6b01efa0705e91a7aca54271510bf9e594717f34");
 assert.equal(q.accepts[0].asset.toLowerCase(),BASE_USDC.toLowerCase());
});

test("LOCAL MOCK ONLY: fake receipt x402 settlement permits read-only proof",async()=>{
 const first=await fetch(livePath(tx,to,"4",from));
 assert.equal(first.status,402);
 const q=JSON.parse(Buffer.from(first.headers.get("payment-required"),"base64").toString());
 const fake=Buffer.from(JSON.stringify({
   x402Version:2,resource:q.resource,accepted:q.accepts[0],
   payload:{
     signature:"0x"+"11".repeat(65),
     authorization:{
       from:"0x"+"33".repeat(20),to:q.accepts[0].payTo,
       value:q.accepts[0].amount,validAfter:"0",validBefore:"9999999999",
       nonce:"0x"+"44".repeat(32)
     }
   },extensions:q.extensions||{}
 })).toString("base64");
 const r=await fetch(livePath(tx,to,"4",from),{headers:{"PAYMENT-SIGNATURE":fake}});
 const raw=await r.text();
 assert.equal(r.status,200,"LOCAL FAKE payment, not real: "+raw.slice(0,250));
 const j=JSON.parse(raw);
 assert.equal(j.verifiedNativeUSDCReceipt,true);
 assert.equal(j.netIncomingUSDC,"4.000000");
 assert.equal(j.minimumUSDC,"4.000000");
 assert.equal(j.chargedUSDC,"0.005");
 assert.equal(j.transactionHash,tx);
 assert.ok(r.headers.get("payment-response"));
});

test("Free receipt preview is honest nonpayable synthetic proof, no transaction or payment",async()=>{
 const r=await fetch(base+"/v1/receipt-sample");
 assert.equal(r.status,200);
 assert.equal(r.headers.get("payment-required"),null);
 const d=await r.json();
 assert.equal(d.ok,true);
 assert.equal(d.paid,false);
 assert.equal(d.exampleOnly,true);
 assert.equal(d.chargedUSDC,"0");
 assert.equal(d.confirmedIndependentPaidOrdersForThisEndpoint,0);
 assert.match(d.kind,/SYNTHETIC/);
 assert.match(d.illustrativeOutput.payment,/EXAMPLE ONLY/);
 assert.match(d.limitations,/invented placeholders/);
 assert.ok(d.paidEndpoint.endsWith("/v1/base-usdc-receipt"));
});
