import {useRef,useState} from 'react';
import {checkFile,fmtBytes,toJpeg} from './imageTools';
export {cropTo,crop169,MAX_BYTES,TYPES} from './imageTools';
// Drop area for a club, event, placeholder or profile picture. The chosen file is trimmed and shrunk
// here in the browser; only the small JPEG copy is handed back for upload.
export default function ImageDrop({url,onChange,ratio=16/9,maxW=1280,ratioLabel='16:9',optional=true}){
 const [preview,setPreview]=useState(''),[removed,setRemoved]=useState(false),[msg,setMsg]=useState(''),[over,setOver]=useState(false),[busy,setBusy]=useState(false),input=useRef(null);
 const shown=preview||(removed?'':url);
 const take=async f=>{
  setMsg('');if(!f)return;
  const bad=checkFile(f);if(bad){setMsg(bad);return}
  setBusy(true);
  try{
   const r=await toJpeg(f,{ratio,maxW,quality:.85,maxBytes:1.5*1024*1024});
   setPreview(URL.createObjectURL(r.blob));setRemoved(false);onChange({file:r.blob});
   const note=r.small?`This image is small and may look soft. ${maxW} pixels wide or more is best. `:r.trimmed?`We trimmed the image to ${ratioLabel} so it fits. `:'';
   setMsg(`${note}Ready to upload: ${fmtBytes(r.blob.size)} (original ${fmtBytes(f.size)}).`);
  }catch(e){setMsg(e.message||'Could not read that image. Try another one.')}
  setBusy(false);
 };
 const pick=()=>input.current?.click();
 const remove=()=>{setPreview('');setRemoved(true);setMsg('');onChange({remove:true})};
 return <div>
  <div className={'drop'+(over?' over':'')} style={{aspectRatio:String(ratio)}} role="button" tabIndex={0} aria-label={shown?'Replace cover image':'Add cover image'} onClick={pick}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}}}
   onDragOver={e=>{e.preventDefault();setOver(true)}} onDragLeave={()=>setOver(false)}
   onDrop={e=>{e.preventDefault();setOver(false);take(e.dataTransfer.files?.[0])}}>
   {shown?<img src={shown} alt="Cover preview"/>:<div style={{padding:16}}><b>{busy?'Preparing image…':'Drag an image here, or tap to choose'}</b><div className="m">{optional?'Optional · ':''}{ratioLabel} · JPEG, PNG or WebP · up to 15 MB</div></div>}
  </div>
  <input ref={input} className="sr" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Cover image file" tabIndex={-1} onChange={e=>{take(e.target.files?.[0]);e.target.value=''}}/>
  {shown&&<div className="row" style={{marginTop:8}}><button type="button" className="o" onClick={pick}>Replace</button><button type="button" className="o d" onClick={remove}>Remove</button></div>}
  {msg&&<p role="status" className="m" style={{marginTop:6}}>{msg}</p>}
 </div>}
