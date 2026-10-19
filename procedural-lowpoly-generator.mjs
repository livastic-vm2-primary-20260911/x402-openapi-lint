import {createHash} from "node:crypto";
/* Original deterministic 3D lowpoly GLB generator for VM5. Procedural
 * output and generator source are public, nonexclusive, AI-assisted.
 * Purchases buy delivery/computation convenience, not exclusive copyright.
 */
const palette={
 stone:[.47,.59,.51],stoneDark:[.24,.35,.33],stoneLight:[.68,.76,.70],
 wood:[.38,.26,.21],woodLight:[.60,.43,.29],metal:[.33,.4,.39],
 gold:[.84,.67,.41],glass:[.38,.86,.76],glow:[.82,.98,.68],rune:[.35,.87,.76]
};
function random(seed) {
 let n=(seed>>>0)||0x974a66f1;
 return () => {n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};
}
export function generateOriginalGlb(kind="lantern",seed=0) {
 if(!["lantern","marker"].includes(kind)||!Number.isSafeInteger(seed)||seed<0||seed>999999)
  throw Error("kind must be lantern or marker; seed must be integer 0..999999");
 const rnd=random(seed+1),scale=.88+rnd()*.24,peak=.9+rnd()*.18;
 const groups=new Map();let triangles=0;
 function triangle(a,b,c,m) {
  if(!palette[m])throw Error("Unknown material");
  const ab=b.map((x,i)=>x-a[i]),ac=c.map((x,i)=>x-a[i]);
  const nn=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const l=Math.hypot(...nn);
  if(l<1e-8)throw Error("Degenerate original triangle");
  const norm=nn.map(x=>x/l);
  let verts=groups.get(m);
  if(!verts){verts=[];groups.set(m,verts);}
  for(const p of [a,b,c])verts.push(...p,...norm);
  triangles++;
 }
 function quad(a,b,c,d,m){triangle(a,b,c,m);triangle(a,c,d,m);}
 function ring(x,y0,y1,z,r0,r1,m,count=8,rotation=0) {
  const low=[],top=[];
  for(let i=0;i<count;i++) {
   const a=i*2*Math.PI/count+rotation;
   low.push([x+Math.cos(a)*r0,y0,z+Math.sin(a)*r0]);
   top.push([x+Math.cos(a)*r1,y1,z+Math.sin(a)*r1]);
  }
  for(let i=0;i<count;i++)quad(low[i],low[(i+1)%count],top[(i+1)%count],top[i],m);
  for(let i=1;i<count-1;i++){
   triangle(low[0],low[i+1],low[i],m);
   triangle(top[0],top[i],top[i+1],m);
  }
 }
 function box(x,y,z,w,h,d,m,a=0) {
  const cs=Math.cos(a),sn=Math.sin(a),v=[];
  for(const Y of [-.5,.5])
   for(const [X,Z] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]])
    v.push([x+X*w*cs+Z*d*sn,y+Y*h,z-X*w*sn+Z*d*cs]);
  for(const [p,q,r,s] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
   quad(v[p],v[q],v[r],v[s],m);
 }
 if(kind==="lantern") {
  ring(0,0,.15*peak,0,.52*scale,.47*scale,"stoneDark");
  ring(0,.15*peak,.26*peak,0,.47*scale,.40*scale,"stone");
  box(0,.40*peak,0,.40*scale,.30*peak,.40*scale,"wood");
  ring(0,.55*peak,.64*peak,0,.4*scale,.4*scale,"metal");
  for(const x of [-.27,.27])for(const z of [-.27,.27])
   box(x*scale,1.03*peak,z*scale,.08*scale,.81*peak,.08*scale,"gold");
  ring(0,.71*peak,1.28*peak,0,.30*scale,.29*scale,"glass",8,Math.PI/8);
  ring(0,.78*peak,1.16*peak,0,.105*scale,.105*scale,"glow",8);
  ring(0,1.3*peak,1.46*peak,0,.58*scale,.25*scale,"wood",8,Math.PI/8);
  ring(0,1.46*peak,1.68*peak,0,.29*scale,.04*scale,"woodLight",8);
  ring(0,1.68*peak,1.85*peak,0,.07*scale,.025*scale,"gold",8);
 } else {
  const count=7+seed%3;
  ring(0,0,.17*peak,0,.63*scale,.48*scale,"stoneDark",count,.1);
  ring(0,.17*peak,.74*peak,0,.48*scale,.36*scale,"stone",count,.12);
  ring(0,.74*peak,1.65*peak,0,.36*scale,.27*scale,"stoneLight",count,.12);
  ring(0,1.65*peak,1.9*peak,0,.27*scale,.028*scale,"stone",count,.12);
  ring(0,.47*peak,.54*peak,0,.41*scale,.4*scale,"stoneDark",count,.1);
  ring(0,1.14*peak,1.22*peak,0,.36*scale,.35*scale,"rune",count,.1);
  box(0,.75*peak,.38*scale,.32*scale,.06*peak,.04*scale,"rune");
  for(const [x,z,r] of [[-.5,.22,.18],[.55,.12,.16],[.16,-.5,.18]]) {
   ring(x*scale,0,r*1.6*scale,z*scale,r*1.3*scale,r*.52*scale,"stoneDark",5);
  }
 }
 const mats=[],acc=[],views=[],primitives=[],chunks=[];
 let at=0;
 for(const [name,verts] of groups){
  const positions=Buffer.alloc(verts.length/2*4);
  const normals=Buffer.alloc(verts.length/2*4);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<verts.length;i+=6){
   for(let k=0;k<3;k++){
    positions.writeFloatLE(verts[i+k],(i/2+k)*4);
    normals.writeFloatLE(verts[i+k+3],(i/2+k)*4);
    lo[k]=Math.min(lo[k],verts[i+k]);hi[k]=Math.max(hi[k],verts[i+k]);
   }
  }
  const firstView=views.length;
  views.push({buffer:0,byteOffset:at,byteLength:positions.length,target:34962});
  at+=positions.length;chunks.push(positions);
  views.push({buffer:0,byteOffset:at,byteLength:normals.length,target:34962});
  at+=normals.length;chunks.push(normals);
  const firstAcc=acc.length;
  acc.push({bufferView:firstView,componentType:5126,count:verts.length/6,type:"VEC3",min:lo,max:hi});
  acc.push({bufferView:firstView+1,componentType:5126,count:verts.length/6,type:"VEC3"});
  const pigment=palette[name].map(x=>Math.min(1,x*(.91+rnd()*.08)));
  mats.push({name,pbrMetallicRoughness:{baseColorFactor:pigment.concat(name==="glass"?.82:1),metallicFactor:0,roughnessFactor:.86},doubleSided:true,...(name==="glass"?{alphaMode:"BLEND"}:{})});
  primitives.push({attributes:{POSITION:firstAcc,NORMAL:firstAcc+1},material:mats.length-1,mode:4});
 }
 const buffer=Buffer.concat(chunks);
 const doc={asset:{version:"2.0",generator:"VM5 AI-assisted original deterministic GLB generator"},
  scene:0,scenes:[{nodes:[0]}],nodes:[{name:kind+"_"+seed,mesh:0}],
  meshes:[{name:kind+"_"+seed,primitives}],materials:mats,
  accessors:acc,bufferViews:views,buffers:[{byteLength:buffer.length}],
  extras:{kind,seed,aiAssisted:true,openSourceGenerator:true}};
 const json=Buffer.from(JSON.stringify(doc)),pad=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
 const bin=Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4)]);
 const header=Buffer.alloc(12);header.write("glTF");header.writeUInt32LE(2,4);
 header.writeUInt32LE(12+8+pad.length+8+bin.length,8);
 const jh=Buffer.alloc(8);jh.writeUInt32LE(pad.length,0);jh.writeUInt32LE(0x4E4F534A,4);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004E4942,4);
 const glb=Buffer.concat([header,jh,pad,bh,bin]);
 return {fileName:"lastone_"+kind+"_"+seed+".glb",kind,seed,
  triangles,materials:mats.length,bytes:glb.length,
  sha256:createHash("sha256").update(glb).digest("hex"),
  glbBase64:glb.toString("base64"),
  licensing:"Non-exclusive as-is commercial use only to the extent original project-specific rights are legally held and transferable. AI-assisted design; no exclusive copyright, client ownership or Unity/Blender certification.",
  disclosure:"The deterministic generator source is public. The paid product is hosted generation and convenient GLB binary delivery, NOT proprietary exclusive source or unique intellectual property."};
}
