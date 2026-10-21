import {useEffect,useMemo,useState} from 'react';
import {call} from './firebase';
import Modal from './Modal';
// Permanent deletion of clubs, events and users, done by the deleteClub / deleteEvent / deleteUser functions (admins only).
// The dialog first asks the server what would be removed ("dry run"), shows it, and only deletes after DELETE has been typed.
const FN={club:'deleteClub',event:'deleteEvent',user:'deleteUser'},KEY={club:'clubId',event:'eventId',user:'uid'};
const WORD={club:'club',event:'event',user:'user'};
const ask=(kind,id,extra={})=>call(FN[kind])({[KEY[kind]]:id,...extra}).then(r=>r.data.counts);
const n=(x,w,pl=w+'s')=>`${x} ${x===1?w:pl}`;
// The things that would be removed, as plain sentences (only what is not zero).
export function describe(kind,t){
 const out=[];
 if(kind==='event'){
  if(t.registrations)out.push(`${n(t.registrations,'registration')} (with phone numbers and emails)`);
  if(t.evidence)out.push(`${n(t.evidence,'evidence record')}`);
  if(t.files)out.push(`${n(t.files,'stored file')} (cover, regulation, evidence photos)`);
 }else if(kind==='club'){
  if(t.hostedEvents)out.push(`${n(t.hostedEvents,'event')} hosted by it will stay, without the club`);
  if(t.members)out.push(`${n(t.members,'person','people')} will stop following it`);
  if(t.files)out.push(`${n(t.files,'stored file')} (cover picture)`);
 }else{
  if(t.ownedEvents)out.push(`${n(t.ownedEvents,'event')} they own, with everything in them`);
  if(t.ownedClubs)out.push(`${n(t.ownedClubs,'club')} they own`);
  if(t.registrations)out.push(`${n(t.registrations,'registration')} in other events (spots are freed and the waitlist moves up)`);
  if(t.evidence)out.push(`${n(t.evidence,'evidence record')} and their photos`);
  if(t.emails)out.push(`${n(t.emails,'email')} sent to them, kept for sending`);
  if(t.avatar)out.push(`${n(t.avatar,'profile picture')}`);
 }
 return out;
}
const total=list=>list.reduce((a,c)=>{for(const [k,v] of Object.entries(c)){a[k]=typeof v==='boolean'?(a[k]||0)+(v?1:0):(a[k]||0)+v}return a},{});
// items: [{id,label}]. onDeleted(ids) is called with the ones that were removed.
export default function DeleteDialog({kind,items,onClose,onDeleted}){
 const [plan,setPlan]=useState(null),[typed,setTyped]=useState(''),[owned,setOwned]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[result,setResult]=useState(null);
 useEffect(()=>{
  let live=true;
  Promise.allSettled(items.map(i=>ask(kind,i.id,{dryRun:true}))).then(rs=>{
   if(!live)return;
   const ok=rs.filter(r=>r.status==='fulfilled').map(r=>r.value),bad=rs.map((r,i)=>r.status==='rejected'?`${items[i].label}: ${r.reason?.message||'cannot be deleted'}`:null).filter(Boolean);
   setPlan({sum:total(ok),bad,deletable:items.filter((_,i)=>rs[i].status==='fulfilled')});
  });
  return()=>{live=false};
 },[kind,items]);
 const sum=plan?.sum||{},hasOwned=kind==='user'&&(sum.ownedEvents||sum.ownedClubs);
 const lines=useMemo(()=>plan?describe(kind,sum):[],[plan]);   // eslint-disable-line react-hooks/exhaustive-deps
 const go=async()=>{
  setBusy(true);const ok=[],failed=[];
  for(const [i,it] of plan.deletable.entries()){
   setProgress(i+1);
   try{await ask(kind,it.id,kind==='user'?{deleteOwned:owned}:{});ok.push(it.id)}catch(e){failed.push(`${it.label}: ${e.message}`)}
  }
  setBusy(false);setResult({ok,failed:[...plan.bad,...failed]});onDeleted?.(ok);
 };
 const w=WORD[kind],count=items.length;
 const ready=plan&&plan.deletable.length>0&&typed==='DELETE'&&(!hasOwned||owned)&&!busy;
 return <Modal onClose={busy?()=>{}:onClose}><div className="sheet" aria-label={`Delete ${w}`}>
  {!busy&&<button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>}
  {result?<>
   <h2>{result.ok.length?`Deleted ${n(result.ok.length,w)}`:'Nothing was deleted'}</h2>
   {result.failed.length>0&&<div role="alert"><p><b>Could not delete:</b></p><ul>{result.failed.map(f=><li key={f} className="m">{f}</li>)}</ul></div>}
   <button className="p" onClick={onClose}>Close</button>
  </>:<>
   <h2>Delete {count===1?`this ${w}`:`${count} ${w}s`} permanently?</h2>
   <ul style={{margin:0,paddingLeft:20}}>{items.slice(0,8).map(i=><li key={i.id}><b>{i.label}</b></li>)}{items.length>8&&<li className="m">…and {items.length-8} more</li>}</ul>
   <p style={{color:'#A33A2B',fontWeight:700}}>This cannot be undone. There is no backup or recycle bin.</p>
   {!plan&&<p className="m" role="status">Checking what will be deleted…</p>}
   {plan&&lines.length>0&&<div><p className="m"><b>Also deleted or changed:</b></p><ul style={{margin:'4px 0',paddingLeft:20}}>{lines.map(l=><li key={l} className="m">{l}</li>)}</ul></div>}
   {plan&&!lines.length&&plan.deletable.length>0&&<p className="m">Nothing else is attached to {count===1?'it':'them'}.</p>}
   {plan&&plan.bad.length>0&&<div role="alert"><p className="m"><b>These cannot be deleted:</b></p><ul style={{margin:'4px 0',paddingLeft:20}}>{plan.bad.map(b=><li key={b} className="m">{b}</li>)}</ul></div>}
   {hasOwned&&<label className="m" style={{display:'flex',gap:8,alignItems:'flex-start'}}><input type="checkbox" checked={owned} onChange={e=>setOwned(e.target.checked)}/>Also delete the {n(sum.ownedEvents||0,'event')} and {n(sum.ownedClubs||0,'club')} owned by {count===1?'this user':'these users'}</label>}
   {plan&&plan.deletable.length>0&&<label style={{display:'grid',gap:4}}><span className="m">Type <b>DELETE</b> to confirm</span><input className="f" aria-label="Type DELETE to confirm" autoComplete="off" value={typed} onChange={e=>setTyped(e.target.value)} disabled={busy}/></label>}
   <div className="row"><button className="o" onClick={onClose} disabled={busy}>Cancel</button><button className="p" style={{background:'#A33A2B'}} disabled={!ready} onClick={go}>{busy?`Deleting ${progress} of ${plan.deletable.length}…`:'Delete permanently'}</button></div>
  </>}
 </div></Modal>}
