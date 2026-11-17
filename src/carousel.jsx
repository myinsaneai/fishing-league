import {Component,useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {collection,deleteDoc,doc,onSnapshot,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore';
import {deleteObject,getDownloadURL,ref as sRef,uploadBytes} from 'firebase/storage';
import {db,storage,call} from './firebase';
import {useApp} from './store';
import {newestFirst} from './data';
import {checkFile,toJpeg} from './imageTools';
import {EvidencePhoto,useEventEvidence} from './evidence';
// The photo carousel at the top of the Events page. Admins fill it (Admin > Carousel) with their own uploads and with approved
// evidence photos (copied by the featureEvidencePhoto function, so the private originals stay private) and can switch it off.
// Visitors see a few of the pictures picked at random, and can hide the strip for themselves (remembered on their device).
export const MAX_ITEMS=30,MAX_SHOWN=8,SLIDE_MS=6000,KEY='fl.carousel.collapsed';
const shuffle=a=>{const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}return r};
const newId=()=>Array.from(globalThis.crypto.getRandomValues(new Uint8Array(10)),b=>b.toString(16).padStart(2,'0')).join('');
// The switch and the pictures. Without {all}, the pictures are only listened to while the carousel is on.
export function useCarousel({all=false}={}){
 const [enabled,setEnabled]=useState(null),[items,setItems]=useState(null);   // enabled: null until the switch has been read
 // The carousel only decorates the page, so a problem with it (no permission yet, no connection) must never break the Events page.
 useEffect(()=>{try{return onSnapshot(doc(db,'settings','carousel'),s=>setEnabled((s.data?.()||{}).enabled!==false),()=>setEnabled(true))}catch{setEnabled(true)}},[]);   // if the switch cannot be read, the carousel counts as on
 const on=all||enabled===true;
 useEffect(()=>{
  if(!on){setItems(null);return}
  try{return onSnapshot(collection(db,'carousel'),
   s=>setItems((s.docs||[]).map(d=>{const x=d.data();return {...x,id:d.id,createdAt:x.createdAt?.toDate?.()||null}}).sort((a,b)=>(b.createdAt?.getTime?.()||0)-(a.createdAt?.getTime?.()||0))),
   ()=>setItems([]))}catch{setItems([])}
 },[on]);
 return {enabled:enabled!==false,known:enabled!==null,items:items||[],loading:on&&items===null};
}
function useCollapsed(){
 const [c,setC]=useState(()=>{try{return localStorage.getItem(KEY)==='1'}catch{return false}});
 const set=v=>{setC(v);try{v?localStorage.setItem(KEY,'1'):localStorage.removeItem(KEY)}catch{}};
 return [c,set];
}
// Download links for the given Storage paths, fetched once each.
function useUrls(paths){
 const [urls,setUrls]=useState({}),seen=useRef(new Set()),key=paths.filter(Boolean).join('|');
 useEffect(()=>{
  let live=true;
  key.split('|').filter(p=>p&&!seen.current.has(p)).forEach(p=>{seen.current.add(p);Promise.resolve().then(()=>getDownloadURL(sRef(storage,p))).then(u=>{if(live&&u)setUrls(x=>({...x,[p]:u}))},()=>{seen.current.delete(p)})});
  return()=>{live=false};
 },[key]);
 return urls;
}
const reducedMotion=()=>{try{return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
// If anything in the carousel fails while drawing, the strip disappears and the rest of the page carries on.
class Quiet extends Component{state={bad:false};static getDerivedStateFromError(){return {bad:true}};componentDidCatch(){}render(){return this.state.bad?null:this.props.children}}
export const SafeCarousel=()=><Quiet><Carousel/></Quiet>;
function Carousel(){
 const {enabled,known,items}=useCarousel(),{events}=useApp(),[collapsed,setCollapsed]=useCollapsed();
 const key=items.map(i=>i.id).sort().join('|');
 const ids=useMemo(()=>shuffle(key?key.split('|'):[]).slice(0,MAX_SHOWN),[key]);   // a new random pick each visit, stable while the page is open
 const byId=new Map(items.map(i=>[i.id,i])),shown=ids.map(id=>byId.get(id)).filter(Boolean),n=shown.length;
 const [reduced]=useState(reducedMotion),[i,setI]=useState(0),[playing,setPlaying]=useState(!reduced),[hold,setHold]=useState(false);
 const at=n?Math.min(i,n-1):0,cur=shown[at];
 const urls=useUrls(collapsed||!n?[]:[cur?.path,shown[(at+1)%n]?.path]);
 useEffect(()=>{
  if(collapsed||!playing||hold||reduced||n<2)return;
  const t=setInterval(()=>setI(x=>(x+1)%n),SLIDE_MS);
  return()=>clearInterval(t);
 },[collapsed,playing,hold,reduced,n]);
 if(!known||!enabled||!n)return null;
 const go=d=>setI((at+d+n)%n),url=urls[cur.path],event=cur.eventId&&events.find(e=>e.id===cur.eventId);
 return <section className="car" aria-roledescription="carousel" aria-label="Photos from the league" onMouseEnter={()=>setHold(true)} onMouseLeave={()=>setHold(false)} onFocus={()=>setHold(true)} onBlur={()=>setHold(false)}>
  <div className="car-h"><b>Photos from the league</b>
   {!collapsed&&n>1&&<><span className="m" aria-hidden="true">{at+1} / {n}</span>
    <button type="button" className="o" aria-label="Previous photo" onClick={()=>go(-1)}>‹</button>
    <button type="button" className="o" aria-label="Next photo" onClick={()=>go(1)}>›</button>
    <button type="button" className="o" aria-label={playing?'Pause the slideshow':'Play the slideshow'} aria-pressed={!playing} onClick={()=>setPlaying(p=>!p)}>{playing?'❚❚':'▶'}</button></>}
   <button type="button" className="o" aria-expanded={!collapsed} aria-controls="car-body" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'Show photos':'Hide photos'}</button></div>
  {!collapsed&&<div id="car-body" className="car-s" role="group" aria-roledescription="slide" aria-label={`${at+1} of ${n}`} aria-live={playing&&!hold?'off':'polite'}>
   {url&&<><img className="car-bg" src={url} alt="" aria-hidden="true"/><img className="car-fg" src={url} alt={cur.caption?'':'Photo from the league'}/></>}
   {cur.caption&&(event?<Link className="car-cap" to={'/event/'+event.id}>{cur.caption}</Link>:<span className="car-cap">{cur.caption}</span>)}</div>}
 </section>;
}
// ---- Admin > Carousel ----
function Item({item}){
 const [cap,setCap]=useState(item.caption||''),[msg,setMsg]=useState('');
 const dirty=cap.trim()!==(item.caption||'');
 const save=async()=>{setMsg('');try{await updateDoc(doc(db,'carousel',item.id),{caption:cap.trim().slice(0,100)});setMsg('Saved.')}catch(e){setMsg(e.message)}};
 const remove=async()=>{
  if(!window.confirm('Remove this photo from the carousel?'))return;
  setMsg('');
  try{await deleteDoc(doc(db,'carousel',item.id))}catch(e){setMsg(e.message);return}
  try{await deleteObject(sRef(storage,item.path))}catch{}   // the record is what matters; a leftover file is not shown anywhere
 };
 return <div className="li" style={{alignItems:'flex-start'}}><EvidencePhoto path={item.path} width={96} height={72}/>
  <div className="g" style={{display:'grid',gap:6}}><label className="m" style={{display:'grid',gap:4}}>Caption<input className="f" maxLength={100} value={cap} onChange={e=>{setCap(e.target.value);setMsg('')}}/></label>
   <span className="m">{item.source==='evidence'?'From an approved evidence photo':'Uploaded by an admin'}</span>
   {msg&&<span role="status" className="m">{msg}</span>}</div>
  <div className="row"><button type="button" className="o" disabled={!dirty} onClick={save}>Save caption</button><button type="button" className="o d" onClick={remove}>Remove</button></div></div>}
function Upload({count,user}){
 const [cap,setCap]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const take=async f=>{
  if(!f||busy)return;setMsg('');
  const bad=checkFile(f);if(bad){setMsg(bad);return}
  if(count>=MAX_ITEMS){setMsg(`The carousel holds up to ${MAX_ITEMS} photos. Remove one first.`);return}
  setBusy(true);const id=newId(),path=`carousel/${id}.jpg`;let up=false;
  try{
   const r=await toJpeg(f,{maxW:1600,maxMP:2,quality:.82,maxBytes:1.9*1024*1024});
   await uploadBytes(sRef(storage,path),r.blob,{contentType:'image/jpeg'});up=true;
   await setDoc(doc(db,'carousel',id),{path,caption:cap.trim().slice(0,100),source:'upload',createdAt:serverTimestamp(),createdBy:user.id});
   setCap('');setMsg('Photo added.');
  }catch(e){if(up)try{await deleteObject(sRef(storage,path))}catch{}setMsg(e.message||'Could not add that photo.')}
  setBusy(false);
 };
 return <div className="c" style={{display:'grid',gap:10}}><b>Upload a photo</b><p className="m">JPEG, PNG or WebP up to 15 MB. It is shrunk before it is sent, and hidden data such as the location is removed.</p>
  <label className="m" style={{display:'grid',gap:4}}>Caption (optional)<input className="f" maxLength={100} value={cap} onChange={e=>setCap(e.target.value)}/></label>
  <label className="o btn" style={{justifySelf:'start',cursor:busy?'wait':'pointer'}}>{busy?'Adding…':'Choose a photo'}<input className="sr" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Photo to add" disabled={busy} tabIndex={-1} onChange={e=>{take(e.target.files?.[0]);e.target.value=''}}/></label>
  {msg&&<p role="status" className="m">{msg}</p>}</div>}
function FromEvidence({items}){
 const {events}=useApp(),[eventId,setEventId]=useState(''),[busy,setBusy]=useState(''),[msg,setMsg]=useState('');
 const {list,loading,error}=useEventEvidence(eventId,{enabled:!!eventId});
 const approved=list.filter(v=>v.status==='Approved'),full=items.length>=MAX_ITEMS;
 const add=async v=>{setBusy(v.id);setMsg('');try{await call('featureEvidencePhoto')({eventId,evidenceId:v.id});setMsg('Added to the carousel.')}catch(e){setMsg(e.message||'Could not add that photo.')}setBusy('')};
 return <div className="c" style={{display:'grid',gap:10}}><b>Add an approved evidence photo</b>
  <p className="m">A copy is shown in the carousel with the event name and the species. The person's name is not shown, and the original stays private.</p>
  <select className="f" aria-label="Event" value={eventId} onChange={e=>{setEventId(e.target.value);setMsg('')}}><option value="">Choose an event</option>{[...events].sort(newestFirst).map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
  {eventId&&loading&&<p className="m">Loading…</p>}{error&&<p role="alert" className="m">{error}</p>}
  {eventId&&!loading&&!approved.length&&<p className="m">No approved photos for this event yet.</p>}
  {approved.map(v=>{const inIt=items.some(i=>i.eventId===eventId&&i.evidenceId===v.id);return <div className="li" key={v.id}><EvidencePhoto path={v.photoPath} width={96} height={72}/><span className="g"><b>{v.species}</b>{v.weight!=null&&<span className="m"> · {v.weight} kg</span>}</span>
   <button type="button" className="o" disabled={inIt||full||!!busy} onClick={()=>add(v)}>{inIt?'In the carousel':busy===v.id?'Adding…':'Add to carousel'}</button></div>})}
  {full&&eventId&&<p className="m">The carousel holds up to {MAX_ITEMS} photos. Remove one first.</p>}
  {msg&&<p role="status" className="m">{msg}</p>}</div>}
export function CarouselAdmin(){
 const {user}=useApp(),{enabled,items,loading}=useCarousel({all:true}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 if(!['admin','superadmin'].includes(user?.role))return <p>Admins only.</p>;
 const toggle=async v=>{setBusy(true);setMsg('');try{await setDoc(doc(db,'settings','carousel'),{enabled:v,updatedAt:serverTimestamp()},{merge:true})}catch(e){setMsg(e.message)}setBusy(false)};
 return <div style={{display:'grid',gap:16}}>
  <div className="c" style={{display:'grid',gap:8}}><label className="row" style={{gap:10,cursor:'pointer'}}><input type="checkbox" role="switch" checked={enabled} disabled={busy} onChange={e=>toggle(e.target.checked)}/><b>Show the carousel on the Events page</b></label>
   <p className="m">{enabled?'The carousel is on. Visitors see up to '+MAX_SHOWN+' of the photos below, picked at random, and each visitor can hide it for themselves.':'The carousel is off. Nobody sees it, whatever is in the list below.'}</p>{msg&&<p role="status" className="m">{msg}</p>}</div>
  <div className="c"><b>Photos in the carousel ({items.length} of {MAX_ITEMS})</b>
   {loading&&<p className="m">Loading…</p>}{!loading&&!items.length&&<p className="m" style={{marginTop:8}}>No photos yet. Upload one, or add an approved evidence photo, below.</p>}
   {items.map(i=><Item key={i.id} item={i}/>)}</div>
  <Upload count={items.length} user={user}/><FromEvidence items={items}/></div>}
