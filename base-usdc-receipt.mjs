// Original public Base mainnet Circle native USDC receipt verification.
// READ ONLY. Fixed chain, contract and RPC destination. Never signs/spends.
export const BASE_CHAIN_ID=8453;
export const BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const ERC20_TRANSFER_TOPIC="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const MIN_CONFIRMATIONS=12;
const RPC_MAINNET="https://1rpc.io/base";
const MAX_RPC_BYTES=950000;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const TRANSACTION=/^0x[0-9a-fA-F]{64}$/;
const DECIMAL=/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,6})?$/;

export function toUSDCAtomic(value) {
  if(typeof value!=="string"||!DECIMAL.test(value))throw new Error("Invalid USDC decimal");
  const parts=value.split(".");
  const out=BigInt(parts[0])*1000000n+BigInt(((parts[1]||"")+"000000").slice(0,6));
  if(out<=0n||out>999999999999999n)throw new Error("USDC threshold outside range");
  return out;
}
export function fromUSDCAtomic(value) {
  if(typeof value!=="bigint"||value<0n)throw new TypeError("Invalid atomic USDC");
  return String(value/1000000n)+"."+String(value%1000000n).padStart(6,"0");
}
export function validateReceiptQuery(query) {
  if(!query||typeof query!=="object"||Array.isArray(query))
    return {ok:false,error:"Provide tx, recipient, minUsdc, and optionally sender"};
  const keys=Object.keys(query);
  if(keys.length<3||keys.length>4||keys.some(k=>!["tx","recipient","minUsdc","sender"].includes(k)))
    return {ok:false,error:"Only tx, recipient, minUsdc, sender are permitted"};
  if(typeof query.tx!=="string"||!TRANSACTION.test(query.tx))
    return {ok:false,error:"tx must be a 0x-prefixed 32-byte transaction hash"};
  if(typeof query.recipient!=="string"||!ADDRESS.test(query.recipient))
    return {ok:false,error:"recipient must be a 0x-prefixed 20-byte EVM address"};
  if("sender" in query && (typeof query.sender!=="string"||!ADDRESS.test(query.sender)))
    return {ok:false,error:"sender must be a 0x-prefixed 20-byte address"};
  try {
    const minAtomic=toUSDCAtomic(query.minUsdc);
    return {ok:true,value:{
      txHash:query.tx.toLowerCase(),
      recipient:query.recipient.toLowerCase(),
      sender:query.sender?.toLowerCase()??null,
      minAtomic
    }};
  } catch {
    return {ok:false,error:"minUsdc must be positive with at most six fractional places"};
  }
}
function parseAddressTopic(value) {
  if(typeof value!=="string"||!TRANSACTION.test(value))
    throw new Error("Malformed native USDC transfer address topic");
  if(!/^0{24}$/.test(value.slice(2,26)))
    throw new Error("Noncanonical indexed ERC20 address");
  return "0x"+value.slice(-40).toLowerCase();
}
function checkHexInt(value,context) {
  if(typeof value!=="string"||!/^0x[0-9a-fA-F]+$/.test(value))
    throw new Error("Invalid "+context+" JSON-RPC quantity");
  return BigInt(value);
}
export function analyzeReceipt(receipt,headBlock,params) {
  if(receipt===null)
    return {ok:false,httpStatus:404,error:"Base transaction receipt absent; no charge requested"};
  if(!receipt||typeof receipt!=="object"||!Array.isArray(receipt.logs)||receipt.logs.length>3000)
    throw new Error("Invalid or oversized receipt");
  if(typeof receipt.transactionHash!=="string"||receipt.transactionHash.toLowerCase()!==params.txHash)
    throw new Error("Provider transaction hash mismatch");
  if(checkHexInt(receipt.status,"transaction status")!==1n)
    return {ok:false,httpStatus:409,error:"Base transaction failed; no charge requested"};
  const txBlock=checkHexInt(receipt.blockNumber,"transaction block");
  const head=checkHexInt(headBlock,"current block");
  if(txBlock>head)throw new Error("Provider head precedes transaction block");
  const confirmations=head-txBlock+1n;
  if(confirmations<BigInt(MIN_CONFIRMATIONS))
    return {ok:false,httpStatus:425,error:"Fewer than 12 observed Base blocks; retry later without paying"};
  let received=0n,spent=0n,fromExpected=0n,transferCount=0;
  for(const log of receipt.logs) {
    if(!log||typeof log!=="object"||typeof log.address!=="string"||
       log.address.toLowerCase()!==BASE_USDC.toLowerCase())continue;
    if(!Array.isArray(log.topics)||log.topics.length!==3||
       String(log.topics[0]).toLowerCase()!==ERC20_TRANSFER_TOPIC)continue;
    if(typeof log.data!=="string"||!TRANSACTION.test(log.data))
      throw new Error("Malformed native USDC log amount");
    const amount=BigInt(log.data);
    const from=parseAddressTopic(log.topics[1]);
    const to=parseAddressTopic(log.topics[2]);
    if(to===params.recipient && from!=="0x0000000000000000000000000000000000000000"){
      received+=amount;
      if(params.sender===null||from===params.sender)fromExpected+=amount;
    }
    if(from===params.recipient)spent+=amount;
    transferCount++;
  }
  const net=received-spent;
  if(net<=0n||net<params.minAtomic||fromExpected<params.minAtomic)
    return {ok:false,httpStatus:422,error:"No sufficient net Circle native Base USDC receipt from the specified recipient/optional sender"};
  return {ok:true,proof:{
    ok:true,verifiedNativeUSDCReceipt:true,paid:true,
    network:"Base",chainId:BASE_CHAIN_ID,
    asset:BASE_USDC,transactionHash:params.txHash,
    recipient:params.recipient,expectedSender:params.sender,
    minimumUSDC:fromUSDCAtomic(params.minAtomic),
    netIncomingUSDC:fromUSDCAtomic(net),
    netIncomingAtomic:net.toString(),
    amountFromMatchingSenderUSDC:fromUSDCAtomic(fromExpected),
    blockNumber:txBlock.toString(),confirmations:confirmations.toString(),
    usdcTransferLogsChecked:transferCount,
    verification:"Successful Base transaction, native Circle USDC Transfer logs, positive net transfer and 12+ observed blocks",
    caveat:"Event-based USDC amount only; does not prove invoice intent, account control, payer KYC, final irrevocability or independently earned income."
  }};
}
export async function baseRpcRead(method,params,{rpcUrl}={}) {
  if(!["eth_chainId","eth_blockNumber","eth_getTransactionReceipt"].includes(method))
    throw new Error("Refusing unapproved or mutating JSON-RPC method");
  const origin=rpcUrl??process.env.BASE_RPC_URL??RPC_MAINNET;
  if(origin!==RPC_MAINNET && !(process.env.NODE_ENV==="test"&&/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)))
    throw new Error("Untrusted Base RPC origin");
  const response=await fetch(origin,{
    method:"POST",headers:{"Content-Type":"application/json","User-Agent":"VM5-Base-USDC-Receipt-ReadOnly/1.0"},
    body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),
    signal:AbortSignal.timeout(8500),redirect:"error"
  });
  if(!response.ok)throw new Error("Base RPC unavailable");
  if(Number(response.headers.get("content-length")||0)>MAX_RPC_BYTES)throw new Error("Base RPC oversized");
  const txt=await response.text();
  if(txt.length>MAX_RPC_BYTES)throw new Error("Base RPC response too large");
  const data=JSON.parse(txt);
  if(!data||typeof data!=="object"||data.error||!("result" in data))
    throw new Error("Invalid Base RPC envelope");
  return data.result;
}
export async function preflightBaseUSDCReceipt(params,read=baseRpcRead) {
  const chain=await read("eth_chainId",[]);
  if(checkHexInt(chain,"chainId")!==BigInt(BASE_CHAIN_ID))
    throw new Error("Provider switched chains");
  const receipt=await read("eth_getTransactionReceipt",[params.txHash]);
  const head=await read("eth_blockNumber",[]);
  return analyzeReceipt(receipt,head,params);
}
