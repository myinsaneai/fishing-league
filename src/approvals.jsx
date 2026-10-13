import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useApp} from './store';
import {useClubs} from './clubsStore';
import {useEvents} from './eventsStore';
import {reviewItem} from './moderation';
import Cover from './Cover';
import {fmt,discLabel,kindLabel} from './data';
const date=d=>d?d.toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}):'';
const FILTERS=[['pending','Pending'],['rejected','Rejected'],['approved','Approved'],['all','All']];
export const pendingCount=(clubs,events)=>clubs.filter(c=>c.status==='pending').length+events.filter(e=>e.status==='pending').length;
const matches=(f,state)=>f==='all'||(f==='approved'?['approved','legacy','published'].includes(state):state===f);
const STATE_LABEL={pending:'Pending approval',rejected:'Not approved',approved:'Approved',published:'Approved',legacy:'No status yet'};
function Row({r,user}){
 const {kind,i,state}=r,[asking,setAsking]=useState(false),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const approvedStatus=kind==='club'?'approved':'published';
 const run=async(status,why)=>{setBusy(true);setErr('');try{await reviewItem(kind,i.id,status,why,user);setAsking(false);setReason('')}catch(e){setErr(e.message)}setBusy(false)};
 const reject=()=>{if(!reason.trim()){setErr('Please give a short reason, so the organiser knows what to change.');return}run('rejected',reason)};
 const details=kind==='club'?[[i.town,i.region].filter(Boolean).join(', '),(i.waterTypes||[]).join(' + ')]:[kindLabel(i),fmt(i),[i.waterbody,i.region].filter(Boolean).join(', '),discLabel(i)];
 const live=state==='approved'||state==='published';
 return <div className="li" style={{alignItems:'flex-start'}}>
  <div style={{width:112,flex:'none'}}><Cover c={i} kind={kind}/></div>
  <div className="g" style={{display:'grid',gap:4}}>
   <div className="row" style={{gap:6}}><span className="t n">{kind==='club'?'Club':'Event'}</span><span className={'t '+(state==='pending'?'a':state==='rejected'?'x':'')}>{STATE_LABEL[state]||state}</span></div>
   <Link to={kind==='club'?'/clubs/'+i.id:'/event/'+i.id}><b>{i.name}</b></Link>
   <span className="m">{details.filter(Boolean).join(' · ')}</span>
   <span className="m">By {i.ownerName||'unknown'}{i.createdAt&&' · created '+date(i.createdAt)}</span>
   {i.reviewedByName&&<span className="m">Reviewed by {i.reviewedByName}{i.reviewedAt&&' on '+date(i.reviewedAt)}{state==='rejected'&&i.rejectionReason?': '+i.rejectionReason:''}</span>}
   {asking&&<div style={{display:'grid',gap:8,marginTop:6}}><textarea className="f" rows={3} maxLength={300} aria-label={'Reason for '+i.name} placeholder="Reason (shown to the organiser)" value={reason} onChange={e=>setReason(e.target.value)}/>
    <div className="row"><button className="o d" disabled={busy} onClick={reject}>{live?'Confirm revoke':'Confirm reject'}</button><button className="o" disabled={busy} onClick={()=>{setAsking(false);setErr('')}}>Cancel</button></div></div>}
   {err&&<span role="alert" className="m" style={{color:'#A33A2B'}}>{err}</span>}</div>
  {!asking&&<div className="row" style={{flex:'none'}}>
   {state==='legacy'?<button className="p" disabled={busy} onClick={()=>run(approvedStatus,'')}>Mark approved</button>:<>
    {!live&&<button className="p" disabled={busy} onClick={()=>run(approvedStatus,'')}>Approve</button>}
    {state!=='rejected'&&<button className="o d" disabled={busy} onClick={()=>setAsking(true)}>{live?'Revoke':'Reject…'}</button>}</>}</div>}
 </div>}
export function Approvals(){
 const {user}=useApp(),{clubs}=useClubs(),{events}=useEvents(),[filter,setFilter]=useState('pending'),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const all=useMemo(()=>[...clubs.map(i=>({kind:'club',i,state:i.status||'legacy'})),...events.filter(e=>!['draft','cancelled'].includes(e.status)).map(i=>({kind:'event',i,state:i.status}))],[clubs,events]);
 const rows=all.filter(r=>matches(filter,r.state)).sort((a,b)=>filter==='pending'?(a.i.createdAt?.getTime()||0)-(b.i.createdAt?.getTime()||0):(b.i.createdAt?.getTime()||0)-(a.i.createdAt?.getTime()||0));
 const legacy=all.filter(r=>r.state==='legacy'),n=all.filter(r=>r.state==='pending').length;
 const approveLegacy=async()=>{setBusy(true);setErr('');try{for(const r of legacy)await reviewItem('club',r.i.id,'approved','',user)}catch(e){setErr(e.message)}setBusy(false)};
 return <div className="c"><p className="m" style={{marginBottom:12}}>New clubs and events only appear publicly after an admin approves them. Items you create yourself are approved automatically.</p>
  <div className="row" style={{marginBottom:8}}>{FILTERS.map(([v,l])=><button key={v} className={'k'+(filter===v?' on':'')} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}{v==='pending'&&n?` (${n})`:''}</button>)}</div>
  {legacy.length>0&&<div className="note" style={{margin:'8px 0'}}><b>{legacy.length} club{legacy.length>1?'s':''} created before approvals existed.</b> They are hidden from the public until marked approved. <button className="o" disabled={busy} style={{marginLeft:8}} onClick={approveLegacy}>Approve all</button></div>}
  {err&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}
  {rows.map(r=><Row key={r.kind+r.i.id} r={r} user={user}/>)}
  {!rows.length&&<p className="m" style={{paddingTop:12}}>{filter==='pending'?'Nothing is waiting for approval.':'Nothing to show here.'}</p>}</div>}
