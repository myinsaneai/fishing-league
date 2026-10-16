import {useEffect,useMemo,useRef,useState} from 'react';
import {collection,onSnapshot,query,where} from 'firebase/firestore';
import {ref as sRef,uploadBytes,getDownloadURL} from 'firebase/storage';
import {db,storage,call} from './firebase';
import {useAuth} from './auth';
import {readGps} from './exif';
import {checkFile,toPhoto,fmtBytes} from './imageTools';
import {pinUrl} from './maps';
// Evidence photos. The photo goes to Storage (evidence/{eventId}/{uid}/{id}.jpg); the record, with the position
// read from the original photo, is created by the submitEvidence function, and organisers review through reviewEvidence.
// Only the person, the event's organiser and admins can read a record or its photo (see the rules).
const newId=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(10)),b=>b.toString(16).padStart(2,'0')).join('');
const fromDoc=(d,eventId)=>{const x=d.data();return {...x,id:d.id,eventId,createdAt:x.createdAt?.toDate?.()||null,reviewedAt:x.reviewedAt?.toDate?.()||null}};
const newest=(a,b)=>(b.createdAt?.getTime?.()||0)-(a.createdAt?.getTime?.()||0);
export async function sendEvidence({uid,eventId,blob,species,gps}){
 const id=newId();
 await uploadBytes(sRef(storage,`evidence/${eventId}/${uid}/${id}.jpg`),blob,{contentType:'image/jpeg'});
 return call('submitEvidence')({eventId,evidenceId:id,species,...(gps?{gps:{lat:gps.lat,lng:gps.lng,...(gps.alt!=null?{alt:gps.alt}:{})}}:{})}).then(r=>r.data);
}
export const reviewEvidence=(eventId,evidenceId,d)=>call('reviewEvidence')({eventId,evidenceId,...d}).then(r=>r.data);
// Everything sent for one event (organisers and admins).
export function useEventEvidence(eventId,{enabled=true}={}){
 const [list,setList]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  if(!enabled||!eventId){setList(null);return}
  setList(null);setError('');
  return onSnapshot(collection(db,'events',eventId,'evidence'),s=>setList(s.docs.map(d=>fromDoc(d,eventId))),e=>{setError(e.message);setList([])});
 },[eventId,enabled]);
 const sorted=useMemo(()=>[...(list||[])].sort(newest),[list]);
 return {list:sorted,loading:enabled&&!!eventId&&list===null,error};
}
// The signed-in person's own evidence across the given events (My page).
export function useMyEvidence(eventIds){
 const {user}=useAuth(),uid=user?.id,key=[...eventIds].sort().join('|');
 const [by,setBy]=useState({});
 useEffect(()=>{
  setBy({});
  if(!uid||!key)return;
  const offs=key.split('|').map(id=>onSnapshot(query(collection(db,'events',id,'evidence'),where('userId','==',uid)),
   s=>setBy(b=>({...b,[id]:s.docs.map(d=>fromDoc(d,id)).filter(x=>x.userId===uid)})),()=>{}));
  return()=>offs.forEach(f=>f());
 },[uid,key]);
 return useMemo(()=>Object.values(by).flat().sort(newest),[by]);
}
// The photo itself. The link is fetched when shown (Storage rules decide who may); it opens full size in a new tab.
export function EvidencePhoto({path,width=64,height=48}){
 const [url,setUrl]=useState('');
 useEffect(()=>{
  let live=true;setUrl('');
  Promise.resolve().then(()=>getDownloadURL(sRef(storage,path))).then(u=>{if(live&&u)setUrl(u)},()=>{});
  return()=>{live=false};
 },[path]);
 const box={width,height,borderRadius:6,background:'#E4E9E6',flex:'none'};
 return url?<a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open photo full size" style={{flex:'none'}}><img src={url} alt="" width={width} height={height} style={{objectFit:'cover',borderRadius:6,display:'block'}}/></a>:<span style={box} aria-hidden="true"/>;
}
// What the organiser sees about where a photo was taken: a Google Maps link when the photo carried a position.
export function PhotoLocation({item}){
 if(item.lat==null||item.lng==null)return <span className="m">No location in this photo</span>;
 const f=n=>Number(n).toFixed(5);
 return <span className="m"><a href={pinUrl(item.lat,item.lng)} target="_blank" rel="noopener noreferrer">Photo location on Google Maps</a> · {f(item.lat)}, {f(item.lng)}{item.alt!=null?` · altitude ${item.alt} m`:''}</span>;
}
// Drop area for the catch photo on My page (drag a photo in, or tap to choose). The position is read from the ORIGINAL file first,
// then the photo is shrunk (imageTools.toPhoto); onChange gets {blob,gps} when a photo is ready, or null when there is none.
// Defined at module level on purpose (a component created inside another one makes inputs lose focus).
export function EvidenceDrop({onChange,disabled=false}){
 const [preview,setPreview]=useState(''),[gps,setGps]=useState(null),[msg,setMsg]=useState(''),[over,setOver]=useState(false),[busy,setBusy]=useState(false),input=useRef(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 const clear=()=>{setPreview('');setGps(null);onChange(null)};
 const take=async f=>{
  if(!f||disabled||busy)return;
  clear();setMsg('');
  const bad=checkFile(f);if(bad){setMsg(bad);return}
  setBusy(true);
  try{
   const g=await readGps(f),r=await toPhoto(f);
   setPreview(URL.createObjectURL(r.blob));setGps(g);onChange({blob:r.blob,gps:g});
   setMsg(`Photo ready: ${fmtBytes(r.blob.size)} (original ${fmtBytes(f.size)}). Only the smaller copy is sent.`);
  }catch(e){setMsg(e.message||'Could not read that image. Try another one.')}
  setBusy(false);
 };
 const pick=()=>{if(!disabled&&!busy)input.current?.click()};
 return <div>
  <div className={'drop'+(over?' over':'')} style={{aspectRatio:'auto',minHeight:150,padding:preview?8:16,opacity:disabled?.6:1}} role="button" tabIndex={0} aria-label={preview?'Replace photo':'Add photo'} aria-disabled={disabled||undefined} onClick={pick}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick()}}}
   onDragOver={e=>{e.preventDefault();if(!disabled)setOver(true)}} onDragLeave={()=>setOver(false)}
   onDrop={e=>{e.preventDefault();setOver(false);take(e.dataTransfer?.files?.[0])}}>
   {preview?<img src={preview} alt="Photo preview" style={{height:'auto',maxHeight:260,objectFit:'contain'}}/>:<div><b>{busy?'Preparing photo…':'Drag a photo here, or tap to choose'}</b><div className="m">JPEG, PNG or WebP · up to 15 MB</div></div>}
  </div>
  <input ref={input} className="sr" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Photo" tabIndex={-1} onChange={e=>{take(e.target.files?.[0]);e.target.value=''}}/>
  {preview&&<div className="row" style={{marginTop:8}}><button type="button" className="o" disabled={disabled} onClick={pick}>Replace</button><button type="button" className="o d" disabled={disabled} onClick={()=>{clear();setMsg('')}}>Remove</button></div>}
  {msg&&<p role="status" className="m" style={{marginTop:6}}>{msg}</p>}
  {preview&&<p className="m" data-testid="gps-note" style={{marginTop:4}}>{gps?'This photo has a location. The organiser will see a map link to it.':'This photo has no location, so the organiser will not see a map link.'}</p>}
 </div>}
