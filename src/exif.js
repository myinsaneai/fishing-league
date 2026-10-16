// Reads the GPS position (latitude, longitude, altitude) that a camera or phone wrote inside a photo (EXIF).
// This must run on the ORIGINAL file: shrinking the photo in the browser (imageTools.js) removes this data on purpose,
// so the position is read first and sent as plain numbers, never inside the picture.
// Handles JPEG, WebP and PNG. Anything unreadable simply gives null: a photo without a position is normal.
const SIZES={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
const round=(n,d)=>Math.round(n*10**d)/10**d;
// v: DataView, t: offset of the TIFF header inside it.
function tiffGps(v,t){
 const bo=v.getUint16(t);
 const le=bo===0x4949?true:bo===0x4d4d?false:null;
 if(le===null||v.getUint16(t+2,le)!==42)return null;
 const u16=o=>v.getUint16(o,le),u32=o=>v.getUint32(o,le);
 const ifd=off=>{const base=t+off,n=u16(base),m={};for(let i=0;i<Math.min(n,200);i++){const e=base+2+i*12;m[u16(e)]={type:u16(e+2),count:u32(e+4),at:e+8}}return m};
 // Where an entry's value lives: inside the entry when it fits in 4 bytes, otherwise at the offset stored there.
 const where=e=>(SIZES[e.type]||1)*e.count<=4?e.at:t+u32(e.at);
 const rat=o=>{const d=u32(o+4);return d?u32(o)/d:NaN};
 const top=ifd(u32(t+4));
 if(!top[0x8825])return null;
 const g=ifd(u32(top[0x8825].at));
 const ref=e=>e?String.fromCharCode(v.getUint8(where(e))).toUpperCase():'';
 const dms=e=>{if(!e||e.type!==5||e.count<3)return NaN;const o=where(e);return rat(o)+rat(o+8)/60+rat(o+16)/3600};
 let lat=dms(g[2]),lng=dms(g[4]);
 if(ref(g[1])==='S')lat=-lat;
 if(ref(g[3])==='W')lng=-lng;
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 if(lat===0&&lng===0)return null;   // 0,0 is what a camera with no fix often writes
 let alt=null;
 if(g[6]&&g[6].type===5){const a=rat(where(g[6]));if(Number.isFinite(a)&&a<20000)alt=round(g[5]&&v.getUint8(where(g[5]))===1?-a:a,1)}
 return {lat:round(lat,6),lng:round(lng,6),alt};
}
const isExif=(v,o)=>v.getUint32(o)===0x45786966&&v.getUint16(o+4)===0;   // "Exif\0\0"
// Finds where the TIFF block starts inside the picture file, or -1.
function findTiff(v){
 const n=v.byteLength;
 if(n>4&&v.getUint16(0)===0xffd8){                                    // JPEG: walk the segments until the image data
  let p=2;
  while(p+4<=n){
   if(v.getUint8(p)!==0xff){p++;continue}
   const m=v.getUint8(p+1);
   if(m===0xff){p++;continue}
   if(m===0xda||m===0xd9)return -1;
   if(m===0x01||(m>=0xd0&&m<=0xd7)){p+=2;continue}
   const len=v.getUint16(p+2);
   if(m===0xe1&&len>=8&&p+4+6<=n&&isExif(v,p+4))return p+10;
   p+=2+len;
  }
  return -1;
 }
 if(n>12&&v.getUint32(0)===0x52494646&&v.getUint32(8)===0x57454250){   // WebP: RIFF chunks
  let p=12;
  while(p+8<=n){
   const id=v.getUint32(p),len=v.getUint32(p+4,true);
   if(id===0x45584946)return p+8+(p+8+6<=n&&isExif(v,p+8)?6:0);
   p+=8+len+(len%2);
  }
  return -1;
 }
 if(n>8&&v.getUint32(0)===0x89504e47){                                // PNG: chunks before the image data
  let p=8;
  while(p+8<=n){
   const len=v.getUint32(p),id=v.getUint32(p+4);
   if(id===0x65584966)return p+8;                                      // "eXIf"
   if(id===0x49444154||id===0x49454e44)return -1;
   p+=12+len;
  }
 }
 return -1;
}
export function parseGps(buffer){
 try{
  const v=new DataView(buffer),t=findTiff(v);
  return t<0?null:tiffGps(v,t);
 }catch{return null}   // a damaged or cut-off tag: treat it as "no position"
}
const bytesOf=b=>b.arrayBuffer?b.arrayBuffer():new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsArrayBuffer(b)});
// JPEG metadata sits at the start of the file; WebP can keep it at the end, so those are read whole (15 MB at most).
export async function readGps(file){
 try{return parseGps(await bytesOf(file.type==='image/jpeg'?file.slice(0,512*1024):file))}catch{return null}
}
