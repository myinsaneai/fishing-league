import {useEffect,useMemo,useState} from 'react';
import {collection,doc,onSnapshot} from 'firebase/firestore';
import {db,call} from './firebase';
import {useAuth} from './auth';
// A participant asks to become an organiser (card on My page); an admin approves or declines (Admin > Approvals > Organisers).
// Requests live in roleRequests/{uid} and are written only by the requestOrganiserRole / decideOrganiserRequest functions.
const MIN=20,MAX=1000;
const date=d=>d?d.toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}):'';
const fromDoc=(id,x)=>({...x,id,createdAt:x.createdAt?.toDate?.()||null,decidedAt:x.decidedAt?.toDate?.()||null});
export const requestOrganiser=reason=>call('requestOrganiserRole')({reason}).then(r=>r.data);
export const decideRequest=(uid,decision,note='')=>call('decideOrganiserRequest')({uid,decision,note}).then(r=>r.data);
// The signed-in participant's own request: undefined while loading, null when there is none.
export function useMyOrganiserRequest(){
 const {user}=useAuth(),uid=user?.id,isParticipant=user?.role==='participant';
 const [req,setReq]=useState(undefined);
 useEffect(()=>{
  if(!uid||!isParticipant){setReq(null);return}
  setReq(undefined);
  return onSnapshot(doc(db,'roleRequests',uid),s=>setReq(typeof s?.exists==='function'&&s.exists()?fromDoc(s.id||uid,s.data()):null),()=>setReq(null));
 },[uid,isParticipant]);
 return req;
}
// All requests, for admins. Newest first. (Rows without the fields of a real request are ignored.)
export function useRoleRequests(enabled){
 const [list,setList]=useState([]);
 useEffect(()=>{
  if(!enabled){setList([]);return}
  return onSnapshot(collection(db,'roleRequests'),s=>setList((s.docs||[]).map(d=>fromDoc(d.id,d.data())).filter(r=>r.uid===r.id&&typeof r.reason==='string')),()=>setList([]));
 },[enabled]);
 return useMemo(()=>[...list].sort((a,b)=>(b.createdAt?.getTime?.()||0)-(a.createdAt?.getTime?.()||0)),[list]);
}
export const pendingRequests=list=>list.filter(r=>r.status==='pending');
// The card on My page. Only participants see it.
export function OrganiserRequestCard(){
 const {user,refresh}=useAuth(),req=useMyOrganiserRequest();
 const [open,setOpen]=useState(false),[text,setText]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[sent,setSent]=useState(false);
 // Once an admin has approved, pick up the new role without making the person sign in again.
 useEffect(()=>{if(req?.status==='approved'&&user?.role==='participant')refresh?.()},[req?.status,user?.role]);   // eslint-disable-line react-hooks/exhaustive-deps
 if(!user||user.role!=='participant'||req===undefined)return null;
 const len=text.trim().length,ok=len>=MIN&&len<=MAX&&!busy;
 const send=async e=>{e.preventDefault();if(!ok)return;setBusy(true);setErr('');try{await requestOrganiser(text);setSent(true);setOpen(false);setText('')}catch(x){setErr(x.message||'Could not send the request. Please try again.')}setBusy(false)};
 const form=<form onSubmit={send} style={{display:'grid',gap:8}}>
  <label style={{display:'grid',gap:4}}><span className="m">Why would you like to be an organiser?</span>
   <textarea className="f" rows={5} maxLength={MAX} aria-label="Why would you like to be an organiser?" placeholder="For example: which club or events you run, and how many people you expect." value={text} onChange={e=>setText(e.target.value)}/></label>
  <span className="m">{len<MIN?`At least ${MIN} characters (${len} so far).`:`${len} of ${MAX} characters.`}</span>
  {err&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}
  <div className="row"><button className="p" disabled={!ok}>{busy?'Sending…':req?.status==='pending'?'Save changes':'Send request'}</button><button type="button" className="o" disabled={busy} onClick={()=>{setOpen(false);setErr('')}}>Cancel</button></div></form>;
 return <div className="c" style={{display:'grid',gap:10}}><h2>Become an organiser</h2>
  {req?.status==='approved'?<p role="status">Your request was approved. Updating your access…</p>
  :req?.status==='pending'?<>
   <p role="status" className="m">Your request is waiting for an admin{req.createdAt?` (sent ${date(req.createdAt)})`:''}. You will get an email when it is decided.</p>
   {!open&&<><p style={{whiteSpace:'pre-wrap',margin:0}}>{req.reason}</p><button className="o" style={{justifySelf:'start'}} onClick={()=>{setText(req.reason);setOpen(true);setSent(false)}}>Edit request</button></>}
   {open&&form}</>
  :<>
   {req?.status==='declined'&&<div className="note" role="status"><b>Your last request was declined.</b>{req.note&&<> Reason: {req.note}</>} You can send a new one.</div>}
   <p className="m" style={{margin:0}}>Organisers can create events and manage their registrations. Tell us why you would like to become one and an admin will review it.</p>
   {sent&&<p role="status" className="m">Request sent. An admin will review it.</p>}
   {open?form:<button className="p" style={{justifySelf:'start'}} onClick={()=>{setOpen(true);setSent(false)}}>Request organiser access</button>}</>}
 </div>}
// One request in the admin list.
export function RequestRow({r}){
 const [asking,setAsking]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const run=async(decision,why='')=>{setBusy(true);setErr('');try{await decideRequest(r.uid,decision,why);setAsking(false);setNote('')}catch(e){setErr(e.message)}setBusy(false)};
 const decline=()=>{if(note.trim().length<3){setErr('Please give a short reason, so the person knows why.');return}run('decline',note)};
 const pending=r.status==='pending',LABEL={pending:'Waiting',approved:'Approved',declined:'Declined'};
 return <div className="li" style={{alignItems:'flex-start'}}>
  <div className="g" style={{display:'grid',gap:4}}>
   <div className="row" style={{gap:6}}><span className="t n">Organiser request</span><span className={'t '+(pending?'a':r.status==='declined'?'x':'')}>{LABEL[r.status]||r.status}</span></div>
   <b>{r.name||r.email}</b>
   <span className="m">{r.email}{r.createdAt&&' · requested '+date(r.createdAt)}</span>
   <p style={{whiteSpace:'pre-wrap',margin:'4px 0'}}>{r.reason}</p>
   {!pending&&<span className="m">{r.status==='approved'?'Approved':'Declined'}{r.decidedByName&&' by '+r.decidedByName}{r.decidedAt&&' on '+date(r.decidedAt)}{r.note?': '+r.note:''}</span>}
   {asking&&<div style={{display:'grid',gap:8,marginTop:6}}><textarea className="f" rows={3} maxLength={300} aria-label={'Reason for declining '+(r.name||r.email)} placeholder="Reason (shown to the person)" value={note} onChange={e=>setNote(e.target.value)}/>
    <div className="row"><button className="o d" disabled={busy} onClick={decline}>Confirm decline</button><button className="o" disabled={busy} onClick={()=>{setAsking(false);setErr('')}}>Cancel</button></div></div>}
   {err&&<span role="alert" className="m" style={{color:'#A33A2B'}}>{err}</span>}</div>
  {pending&&!asking&&<div className="row" style={{flex:'none'}}><button className="p" disabled={busy} onClick={()=>run('approve')}>Approve</button><button className="o d" disabled={busy} onClick={()=>setAsking(true)}>Decline…</button></div>}
 </div>}
