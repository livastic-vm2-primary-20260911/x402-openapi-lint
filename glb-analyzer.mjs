/**
 * Deterministic local GLB v2 geometry auditor. Original VM5 implementation.
 * No remote asset download, no code execution, no customer payload persistence.
 * Pure in-memory buffer parsing; the report is descriptive, not a security audit.
 */
export const MAX_GLB_BYTES = 1_500_000;

function bad(message) { return { ok:false, error:message }; }
function object(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
const isIndex=(x,n)=>Number.isSafeInteger(x)&&x>=0&&x<n;
function validNumberArray(value,n){
  return Array.isArray(value)&&value.length===n&&value.every(x=>typeof x==="number"&&Number.isFinite(x));
}
export function parseGlbBase64(value){
  if(typeof value!=="string" || value.length<28 || value.length>Math.ceil(MAX_GLB_BYTES/3)*4+8 ||
     value.length%4!==0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)){
    return bad("glbBase64 must be canonical base64 for a 28-byte to 1.5MB binary GLB.");
  }
  const binary=Buffer.from(value,"base64");
  if(binary.toString("base64")!==value || binary.length<28 || binary.length>MAX_GLB_BYTES){
    return bad("GLB bytes exceed limit or contain non-canonical base64.");
  }
  if(binary.toString("ascii",0,4)!=="glTF"){
    return bad("Not a GLB file (expected glTF magic).");
  }
  const version=binary.readUInt32LE(4), expectedLength=binary.readUInt32LE(8);
  if(version!==2 || expectedLength!==binary.length){
    return bad("Only GLB 2.0 with exact header byte length is supported.");
  }
  let offset=12, json=null, bin=null, chunkCount=0;
  while(offset<binary.length){
    if(offset+8>binary.length)return bad("GLB chunk header is truncated.");
    const size=binary.readUInt32LE(offset),kind=binary.readUInt32LE(offset+4);
    offset+=8;chunkCount++;
    if(size%4!==0 || size>MAX_GLB_BYTES || offset+size>binary.length || chunkCount>2){
      return bad("GLB contains invalid, unaligned, oversized or too many chunks.");
    }
    const chunk=binary.subarray(offset,offset+size);
    if(chunkCount===1 && kind===0x4E4F534A){
      if(size<2)return bad("GLB JSON is missing.");
      try {json=JSON.parse(chunk.toString("utf8").trimEnd());}
      catch{return bad("GLB JSON chunk is invalid UTF-8 JSON.");}
    }else if(chunkCount===2 && kind===0x004E4942){
      bin=chunk;
    }else{
      return bad("GLB expects a JSON chunk first and an optional BIN chunk second.");
    }
    offset+=size;
  }
  if(offset!==binary.length || !object(json) || !object(json.asset) || json.asset.version!=="2.0"){
    return bad("Missing GLB 2.0 asset metadata.");
  }
  const buffers=json.buffers||[],views=json.bufferViews||[],accessors=json.accessors||[];
  const meshes=json.meshes||[],materials=json.materials||[],images=json.images||[];
  if(![buffers,views,accessors,meshes,materials,images].every(Array.isArray) ||
     buffers.length>1 || views.length>4096 || accessors.length>4096 ||
     meshes.length>512 || materials.length>512 || images.length>128){
    return bad("GLB has unsupported buffer structure or unreasonable object counts.");
  }
  if(buffers.length===0 && (views.length || accessors.length || meshes.length)){
    return bad("GLB geometry requires one embedded buffer.");
  }
  if(buffers.length){
    if(!object(buffers[0]) || "uri" in buffers[0] || !Number.isSafeInteger(buffers[0].byteLength) ||
       buffers[0].byteLength<0 || !bin || buffers[0].byteLength>bin.length ||
       bin.length-buffers[0].byteLength>3){
      return bad("External buffers are prohibited; embedded BIN length must match.");
    }
  }else if(bin){
    return bad("BIN chunk present without declared buffer.");
  }
  for(const v of views){
    if(!object(v) || !isIndex(v.buffer,buffers.length) ||
       !Number.isSafeInteger(v.byteLength)||v.byteLength<0 ||
       !(v.byteOffset===undefined||(Number.isSafeInteger(v.byteOffset)&&v.byteOffset>=0)) ||
       (v.byteOffset||0)+v.byteLength>buffers[v.buffer].byteLength){
      return bad("Invalid GLB bufferView dimensions.");
    }
  }
  const componentBytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
  const componentCounts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
  for(const a of accessors){
    if(!object(a)|| !isIndex(a.bufferView,views.length) || !Number.isSafeInteger(a.count) ||
       a.count<0 || a.count>1_000_000 ||
       !(a.componentType in componentBytes) || !(a.type in componentCounts) ||
       "sparse" in a || !(a.byteOffset===undefined|| (Number.isSafeInteger(a.byteOffset)&&a.byteOffset>=0))){
      return bad("GLB accessor is unsupported, oversized or malformed.");
    }
    const v=views[a.bufferView], elementBytes=componentBytes[a.componentType]*componentCounts[a.type];
    const stride=v.byteStride||elementBytes;
    if(stride<elementBytes || stride>252 || !Number.isSafeInteger(stride) ||
       (a.byteOffset||0)+(a.count? (a.count-1)*stride+elementBytes:0)>v.byteLength){
      return bad("GLB accessor exceeds its declared bufferView.");
    }
  }
  for(const image of images){
    if(!object(image) || (image.uri!==undefined &&
       (typeof image.uri!=="string" || !/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image.uri)))) {
      return bad("External image URLs are prohibited.");
    }
    if(image.bufferView!==undefined && !isIndex(image.bufferView,views.length)){
      return bad("Invalid embedded GLB image bufferView.");
    }
  }
  let triangles=0,primitives=0,vertices=0;
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(const mesh of meshes){
    if(!object(mesh)||!Array.isArray(mesh.primitives)||mesh.primitives.length>512){
      return bad("Invalid mesh primitive array.");
    }
    for(const p of mesh.primitives){
      if(!object(p)||!object(p.attributes)||!isIndex(p.attributes.POSITION,accessors.length)){
        return bad("All mesh primitives must include POSITION accessors.");
      }
      const a=accessors[p.attributes.POSITION];
      if(a.type!=="VEC3"||a.componentType!==5126){
        return bad("POSITION must be float VEC3.");
      }
      const index=p.indices===undefined?null:accessors[p.indices];
      if(p.indices!==undefined && (!isIndex(p.indices,accessors.length) ||
         index.type!=="SCALAR" || ![5121,5123,5125].includes(index.componentType))){
        return bad("Triangle index accessor invalid.");
      }
      if(p.material!==undefined&&!isIndex(p.material,materials.length)){
        return bad("Primitive references non-existing material.");
      }
      const mode=p.mode===undefined?4:p.mode;
      if(![0,1,2,3,4,5,6].includes(mode))return bad("Unsupported primitive mode.");
      const count=index?index.count:a.count;
      if(mode===4 && count%3!==0)return bad("Triangle count must be divisible by three.");
      const faces=mode===4?count/3:([5,6].includes(mode)?Math.max(0,count-2):0);
      triangles+=faces;primitives++;vertices+=a.count;
      if(primitives>2048||triangles>2_000_000)return bad("Unreasonable mesh geometry counts.");
      if(a.min!==undefined || a.max!==undefined){
        if(!validNumberArray(a.min,3)||!validNumberArray(a.max,3)||
           a.min.some((x,i)=>x>a.max[i]))return bad("Invalid POSITION min/max bounds.");
        for(let i=0;i<3;i++){
          bounds[i]=Math.min(bounds[i],a.min[i]);
          bounds[i+3]=Math.max(bounds[i+3],a.max[i]);
        }
      }
    }
  }
  const warnings=[];
  if(triangles===0)warnings.push("No triangle geometry found.");
  if(meshes.length>60)warnings.push("Many meshes: consider batching compatible materials.");
  if(materials.length>40)warnings.push("Large material count: check draw calls.");
  if(triangles>50_000)warnings.push("High triangle count for mobile: profile on target hardware.");
  if(images.length>20)warnings.push("Many images: test GPU texture memory.");
  const hasBounds=bounds.every(Number.isFinite);
  return {
    ok:true,version:"2.0",bytes:binary.length,scenes:Array.isArray(json.scenes)?json.scenes.length:0,
    meshCount:meshes.length,primitiveCount:primitives,triangleCount:triangles,
    positionVertices:vertices,materialCount:materials.length,imageCount:images.length,
    nodeCount:Array.isArray(json.nodes)?json.nodes.length:0,
    dimensions:hasBounds?{
      min:bounds.slice(0,3).map(n=>Number(n.toFixed(5))),
      max:bounds.slice(3).map(n=>Number(n.toFixed(5))),
      span:[0,1,2].map(i=>Number((bounds[i+3]-bounds[i]).toFixed(5)))
    }:null,
    warnings,
    limitations:"In-memory GLB 2 structural/metadata audit only. Not a full GLTF spec validator, malware scan, runtime rendering test, copyright audit, or proof of commercial rights. Coordinates are model-local; nested node transforms not applied. No external textures/buffers fetched.",
  };
}
