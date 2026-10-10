import {useRef,useState} from 'react';
export const MAX_BYTES=2*1024*1024,TYPES=['image/jpeg','image/png','image/webp'];
// Largest centred 16:9 rectangle inside a w x h image, and the output size (max 1280 wide).
export function crop169(w,h){
 let cw=w,ch=h;
 if(w/h>16/9)cw=Math.round(h*16/9);else ch=Math.round(w*9/16);
 const ow=Math.min(1280,cw);
 return {sx:Math.round((w-cw)/2),sy:Math.round((h-ch)/2),sw:cw,sh:ch,ow,oh:Math.round(ow*9/16)};
}
// Trims to 16:9, shrinks to at most 1280x720 and re-encodes (WebP, or JPEG where WebP is unavailable).
export async function toCover(file){
 const bmp=await createImageBitmap(file),c=crop169(bmp.width,bmp.height);
 const cv=document.createElement('canvas');cv.width=c.ow;cv.height=c.oh;
 cv.getContext('2d').drawImage(bmp,c.sx,c.sy,c.sw,c.sh,0,0,c.ow,c.oh);
 let blob=await new Promise(r=>cv.toBlob(r,'image/webp',.85));
 if(!blob||blob.type!=='image/webp')blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.88));
 return {blob,small:bmp.width<640||bmp.height<360,trimmed:Math.abs(bmp.width/bmp.height-16/9)>.02};
}
export default function ImageDrop({url,onChange}){
 const [preview,setPreview]=useState(''),[removed,setRemoved]=useState(false),[msg,setMsg]=useState(''),[over,setOver]=useState(false),[busy,setBusy]=useState(false),input=useRef(null);
 const shown=preview||(removed?'':url);
 const take=async f=>{
  setMsg('');if(!f)return;
  if(!TYPES.includes(f.type)){setMsg('Use a JPEG, PNG or WebP image.');return}
  if(f.size>MAX_BYTES){setMsg('That image is over 2 MB. Please choose a smaller one.');return}
  setBusy(true);
  try{
   const r=await toCover(f);
   setPreview(URL.createObjectURL(r.blob));setRemoved(false);onChange({file:r.blob});
   setMsg(r.small?'This image is small and may look soft. 1280×720 or larger is best.':r.trimmed?'We trimmed the image to 16:9 so it fits the club page.':'');
  }catch{setMsg('Could not read that image. Try another one.')}
  setBusy(false);
 };
 const pick=()=>input.current?.click();
 const remove=()=>{setPreview('');setRemoved(true);setMsg('');onChange({remove:true})};
 return <div>
  <div className={'drop'+(over?' over':'')} role="button" tabIndex={0} aria-label={shown?'Replace cover image':'Add cover image'} onClick={pick}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}}}
   onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)}
   onDrop={e=>{e.preventDefault();setOver(false);take(e.dataTransfer.files?.[0])}}>
   {shown?<img src={shown} alt="Cover preview"/>:<div style={{padding:16}}><b>{busy?'Preparing image…':'Drag an image here, or tap to choose'}</b><div className="m">Optional · 16:9 · JPEG, PNG or WebP · up to 2 MB</div></div>}
  </div>
  <input ref={input} className="sr" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Cover image file" tabIndex={-1} onChange={e=>{take(e.target.files?.[0]);e.target.value=''}}/>
  {shown&&<div className="row" style={{marginTop:8}}><button type="button" className="o" onClick={pick}>Replace</button><button type="button" className="o d" onClick={remove}>Remove</button></div>}
  {msg&&<p role="status" className="m" style={{marginTop:6}}>{msg}</p>}
 </div>}
