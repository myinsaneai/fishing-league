// Photos are prepared in the browser before anything is uploaded: the person can choose a big original
// (up to 15 MB), and only a much smaller JPEG copy ever leaves their device.
export const MAX_BYTES=15*1024*1024;
export const TYPES=['image/jpeg','image/png','image/webp'];
const MAX_INPUT_PIXELS=150e6;   // refuse absurd sizes that could run a phone out of memory
export const fmtBytes=n=>n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`;
export const checkFile=f=>!TYPES.includes(f.type)?'Use a JPEG, PNG or WebP image.':f.size>MAX_BYTES?'That photo is over 15 MB. Please choose a smaller one.':'';
// What to cut out of a w x h picture and how big to make it: an optional centred crop to a ratio,
// then a width cap, then a megapixel cap. Pictures are never enlarged.
export function sizeFor(w,h,{ratio,maxW,maxMP=4}={}){
 let sx=0,sy=0,sw=w,sh=h;
 if(ratio){if(w/h>ratio)sw=Math.round(h*ratio);else sh=Math.round(w/ratio);sx=Math.round((w-sw)/2);sy=Math.round((h-sh)/2)}
 let ow=sw,oh=sh;
 if(maxW&&ow>maxW){oh=Math.round(oh*maxW/ow);ow=maxW}
 if(ow*oh>maxMP*1e6){const k=Math.sqrt(maxMP*1e6/(ow*oh));ow=Math.floor(ow*k);oh=Math.floor(oh*k)}
 if(ratio)oh=Math.round(ow/ratio);
 return {sx,sy,sw,sh,ow,oh};
}
export const cropTo=(w,h,ratio,maxW)=>sizeFor(w,h,{ratio,maxW,maxMP:Infinity});
export const crop169=(w,h)=>cropTo(w,h,16/9,1280);
async function decode(file){
 if(typeof createImageBitmap==='function'){
  try{const b=await createImageBitmap(file);return {img:b,w:b.width,h:b.height,close:()=>b.close?.()}}catch{}
 }
 const url=URL.createObjectURL(file),img=new Image();
 img.src=url;
 try{await img.decode()}catch{URL.revokeObjectURL(url);throw new Error('Could not read that image. Try another one.')}
 return {img,w:img.naturalWidth,h:img.naturalHeight,close:()=>URL.revokeObjectURL(url)};
}
const blobOf=(cv,q)=>new Promise(r=>cv.toBlob(r,'image/jpeg',q));
// Decodes the picture, trims and shrinks it as asked, and re-encodes it as a JPEG no bigger than maxBytes
// (lowering the quality, then the size, until it fits). Re-encoding also removes hidden data such as GPS location.
export async function toJpeg(file,{ratio,maxW,maxMP=4,quality=.85,maxBytes=2*1024*1024}={}){
 const src=await decode(file);
 try{
  if(src.w*src.h>MAX_INPUT_PIXELS)throw new Error('That photo is too large to prepare on this device. Try a smaller one.');
  const s=sizeFor(src.w,src.h,{ratio,maxW,maxMP});
  let scale=1,blob=null,ow=s.ow,oh=s.oh;
  for(let i=0;i<4;i++){
   ow=Math.max(1,Math.round(s.ow*scale));oh=Math.max(1,Math.round(s.oh*scale));
   const cv=document.createElement('canvas');cv.width=ow;cv.height=oh;
   const ctx=cv.getContext('2d');
   ctx.fillStyle='#fff';ctx.fillRect(0,0,ow,oh);   // transparent PNGs become white, not black
   ctx.imageSmoothingQuality='high';ctx.drawImage(src.img,s.sx,s.sy,s.sw,s.sh,0,0,ow,oh);
   let q=quality;blob=await blobOf(cv,q);
   while(blob&&blob.size>maxBytes&&q>.55){q=Math.round((q-.1)*100)/100;blob=await blobOf(cv,q)}
   if(blob&&blob.size<=maxBytes)break;
   scale*=.85;
  }
  if(!blob)throw new Error('Could not prepare that image.');
  if(blob.size>maxBytes)throw new Error('That photo could not be made small enough. Try a different one.');
  return {blob,width:ow,height:oh,originalBytes:file.size,small:!!maxW&&s.sw<maxW/2,trimmed:!!ratio&&Math.abs(src.w/src.h-ratio)>.02};
 }finally{src.close()}
}
// A full photo (for example a catch photo): any shape, at most 4 megapixels, about 3 MB at most.
export const toPhoto=file=>toJpeg(file,{maxMP:4,quality:.82,maxBytes:3*1024*1024});
