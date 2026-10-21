import {useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useApp} from './store';
import {Users} from './roles';
import Modal from './Modal';
import {useClubs,isApprovedClub} from './clubsStore';
import {useRegistrations,useEventRegistrations} from './registrations';
import Banner from './Status';
import {Approvals,PendingBadge,pendingCount} from './approvals';
import {Cleanup} from './cleanup';
import {useEvents} from './eventsStore';
import Cover from './Cover';
import AvatarEditor from './avatarEditor';
import {sendEvidence,reviewEvidence,useMyEvidence,useEventEvidence,EvidencePhoto,EvidenceDrop,PhotoLocation} from './evidence';
import {MapView} from './maps';
import {usePlaceholders} from './placeholders';
import {PlaceholderSettings} from './placeholderSettings';
import {DISC,REGIONS,DISTRICTS,SPECIES,status,isPast,daysTo,fmt,fmtDays,fmtRange,fmtTime,discLabel,EVENT_KINDS,kindLabel,registrationOpen,regCloseText,WATER,waterLabel} from './data';
const badge=s=>s==='Registration open'||s==='Accepted'||s==='On site'||s==='Approved'?'':s==='Disqualified'||s==='Rejected'||s==='Cancelled'||s==='Declined'?'x':s==='Finished'||s==='Draft'?'n':'a';
const Spots=({e,n})=><><div className="bar"><i style={{width:Math.min(100,n/e.limit*100)+'%'}}/></div><span className="m">{n} of {e.limit} spots filled</span></>;
export function Catalog(){
 const {events,taken,user}=useApp();const {loading}=useEvents();const can=user&&user.role!=='participant';
 // Basic search: fishing type and region. Everything else lives under "More filters".
 const [wt,setWt]=useState('All'),[rg,setRg]=useState(''),[more,setMore]=useState(false);
 const [kd,setKd]=useState('All'),[q,setQ]=useState(''),[d,setD]=useState('All'),[ds,setDs]=useState(''),[st,setSt]=useState(''),[fm,setFm]=useState('');
 const advanced=[q.trim(),ds,d!=='All'&&d,kd!=='All'&&kd,st,fm].filter(Boolean).length,filtered=wt!=='All'||!!rg||advanced>0;
 const clear=()=>{setWt('All');setRg('');setQ('');setD('All');setKd('All');setDs('');setSt('');setFm('')};
 const list=events.filter(e=>(wt==='All'||e.water===wt)&&(!rg||e.region===rg)&&(d==='All'||e.disc===d)&&(kd==='All'||e.kind===kd)&&(!ds||e.district===ds)&&(!fm||e.format===fm)&&(!st||status(e,taken(e.id))===st)&&(e.name+' '+e.waterbody).toLowerCase().includes(q.trim().toLowerCase()));
 return <><div className="row" style={{justifyContent:'space-between',marginBottom:16}}><h1>Events</h1>{can&&<Link className="p btn" to="/event/new">Create event</Link>}</div>
  <div className="c" style={{display:'grid',gap:12,marginBottom:20}}>
   <div className="row" role="group" aria-label="Fishing type">{WATER.map(w=><button key={w.v} className={'k'+(wt===w.v?' on':'')} aria-pressed={wt===w.v} onClick={()=>setWt(w.v)}>{w.l}</button>)}</div>
   <div className="row"><select className="f" aria-label="Region" value={rg} onChange={e=>{setRg(e.target.value);setDs('')}}><option value="">All regions</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
    <button type="button" className="o" aria-expanded={more} aria-controls="more-filters" onClick={()=>setMore(!more)}>{more?'Fewer filters':'More filters'}{advanced>0?` (${advanced})`:''}</button>
    {filtered&&<button type="button" className="lnk" onClick={clear}>Clear all</button>}</div>
   {more&&<div id="more-filters" className="adv"><input className="f" aria-label="Search" placeholder="Search events or waterbodies" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="row" role="group" aria-label="Event type">{[{v:'All',l:'All types'},...EVENT_KINDS.map(k=>({v:k.v,l:k.l+'s'}))].map(k=><button key={k.v} className={'k'+(kd===k.v?' on':'')} aria-pressed={kd===k.v} onClick={()=>setKd(k.v)}>{k.l}</button>)}</div>
    <div className="row" role="group" aria-label="Discipline">{['All',...DISC].map(x=><button key={x} className={'k'+(d===x?' on':'')} aria-pressed={d===x} onClick={()=>setD(x)}>{x}</button>)}</div>
    <div className="row">{(DISTRICTS[rg]||[]).length>0&&<select className="f" aria-label="District" value={ds} onChange={e=>setDs(e.target.value)}><option value="">All districts</option>{DISTRICTS[rg].map(x=><option key={x}>{x}</option>)}</select>}
     <select className="f" aria-label="Status" value={st} onChange={e=>setSt(e.target.value)}><option value="">Any status</option><option>Registration open</option><option>Waitlist</option><option>In progress</option><option>Finished</option><option>Cancelled</option></select>
     <select className="f" aria-label="Format" value={fm} onChange={e=>setFm(e.target.value)}><option value="">Individual / Team</option><option>Individual</option><option>Team</option></select></div></div>}</div>
  {filtered&&events.length>0&&<p className="m" role="status" style={{margin:'-8px 0 12px'}}>Showing {list.length} of {events.length} events</p>}
  <div className="grid">{list.map(e=>{const n=taken(e.id),s=status(e,n);return <Link key={e.id} to={'/event/'+e.id} className="c card"><Cover c={e} kind="event"/><div style={{padding:16,display:'grid',gap:8}}>
   <div className="row" style={{gap:6}}><span className="t">{kindLabel(e)}</span><span className="t">{discLabel(e)}</span><span className="t n">{e.water}</span><span className={'t '+badge(s)}>{s}</span></div><b>{e.name}</b><span className="m">{fmtDays(e)} · {e.waterbody}, {e.region}</span><Spots e={e} n={n}/></div></Link>})}
   {!list.length&&<p className="m">{loading?'Loading events…':events.length?'No events match these filters.':'No events yet.'+(can?' Create the first one.':'')}</p>}</div></>}
export function EventPage(){
 const {id}=useParams();const {events,user,real,taken,setSignIn}=useApp();const {clubs}=useClubs();const {loading}=useEvents();const ph=usePlaceholders();
 const {mine,register,cancel}=useRegistrations();const e=events.find(x=>x.id===id);
 const [open,setOpen]=useState(false),[tab,setTab]=useState('Details'),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[notice,setNotice]=useState(''),[askCancel,setAskCancel]=useState(false);
 const [f,setF]=useState({name:'',phone:'',club:'',team:'',ok:false});
 const {list,loading:listLoading}=useEventRegistrations(id,{enabled:tab==='Participants'});
 if(!e)return loading?<p className="m">Loading…</p>:<p>Event not found.</p>;
 const n=taken(e.id),w=e.counts?.waitlist||0,s=status(e,n),full=n>=e.limit,my=mine[e.id],holding=!!my&&['Accepted','Waitlist','On site'].includes(my.status),started=!!e.startsAt&&e.startsAt<=new Date();
 const clubName=clubs.find(c=>c.id===e.club)?.name,canEdit=user&&(e.org===user.id||['admin','superadmin'].includes(user.role)),signedIn=!!user&&real;
 const going=list.filter(r=>['Accepted','On site'].includes(r.status)),waiting=list.filter(r=>r.status==='Waitlist');
 const openForm=()=>{setErr('');setNotice('');setF({name:user.name||'',phone:'',club:'',team:'',ok:false});setOpen(true)};
 const go=async ev=>{ev.preventDefault();setBusy(true);setErr('');try{const r=await register({eventId:e.id,name:f.name,phone:f.phone,clubId:f.club,teamName:f.team,acceptRules:f.ok});setOpen(false);setNotice(r.status==='Accepted'?"You're registered. A confirmation is on its way to your email.":`You're on the waitlist (position ${r.waitlistPosition}). We will email you if a spot opens up.`)}catch(x){setErr(x.message)}setBusy(false)};
 const doCancel=async()=>{setBusy(true);setErr('');try{await cancel(e.id);setAskCancel(false);setNotice('Your registration has been cancelled.')}catch(x){setErr(x.message);setAskCancel(false)}setBusy(false)};
 const closedLabel=e.status==='cancelled'?'Cancelled':e.status==='draft'?'Draft (not public)':e.status==='pending'?'Awaiting approval':e.status==='rejected'?'Not approved':isPast(e)?'Finished':'Registration closed';
 const who=r=><span className="g">{r.name}{r.teamName&&<span className="m"> · Team {r.teamName}</span>}{r.clubId&&clubs.find(c=>c.id===r.clubId)&&<span className="m"> · {clubs.find(c=>c.id===r.clubId).name}</span>}</span>;
 return <><p className="m"><Link to="/">Events</Link> / {e.name}</p><div className="row" style={{justifyContent:'space-between',margin:'8px 0 12px'}}><h1>{e.name}</h1>{canEdit&&<Link className="o btn" to={'/event/'+e.id+'/edit'}>Edit event</Link>}</div><div className="row" style={{gap:6}}><span className="t">{kindLabel(e)}</span><span className="t">{waterLabel(e)}</span><span className="t">{discLabel(e)}</span><span className="t">{e.format}</span><span className={'t '+badge(s)}>{s}</span></div>
  {canEdit&&<div style={{marginTop:16}}><Banner item={e} what="event"/></div>}
  {(e.coverUrl||ph.event)&&<div style={{maxWidth:760,marginTop:16}}><Cover c={e} kind="event" alt={e.name+' photo'}/></div>}
  <div className="two" style={{marginTop:16}}><div><div className="tb">{['Details','Participants','Results'].map(t=><button key={t} className={tab===t?'on':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
   {tab==='Details'&&<><div className="c" style={{display:'grid',gap:12}}><p style={{whiteSpace:'pre-wrap',lineHeight:1.6}}>{e.description||'No description yet.'}</p>{e.meetingPoint&&<p><b>Meeting point:</b> {e.meetingPoint}</p>}</div><MapView item={e} style={{marginTop:16}}/></>}
   {tab==='Participants'&&<div className="c">{listLoading?<p className="m">Loading…</p>:<>{going.map(r=><div className="li" key={r.id}>{who(r)}{r.status==='On site'&&<span className="t">On site</span>}</div>)}
    {waiting.length>0&&<><b style={{display:'block',margin:'14px 0 2px'}}>Waitlist</b>{waiting.map((r,i)=><div className="li" key={r.id}><span className="m" style={{width:24}}>{i+1}</span>{who(r)}</div>)}</>}
    {!going.length&&!waiting.length&&<p className="m">Nobody has registered yet.</p>}</>}<p className="m" style={{marginTop:10}}>Names only. Contacts are visible to the organiser.</p></div>}
   {tab==='Results'&&<div className="c"><p className="m">Results appear here once the organiser approves catches.</p></div>}</div>
  <div className="c" style={{display:'grid',gap:10}}><span className="m">When</span><b>{fmtRange(e)}</b><span className="m">Where</span><b>{[e.waterbody,e.district,e.region].filter(Boolean).join(', ')}</b><span className="m">Entry fee</span><b>{e.fee?'NZD '+e.fee:'Free'}</b><span className="m">Registration closes</span><b>{regCloseText(e)}</b><Spots e={e} n={n}/>{w>0&&<span className="m">{w} on the waitlist</span>}<span className="m">Organiser: {e.ownerName}{clubName&&' · '+clubName}</span>
   {holding?<><span className={'t '+badge(my.status)} style={{justifySelf:'start'}}>You: {my.status}</span>
     {my.status!=='On site'&&!started&&(askCancel?<div className="row"><button className="o d" disabled={busy} onClick={doCancel}>Yes, cancel</button><button className="o" onClick={()=>setAskCancel(false)}>Keep my place</button></div>:<button className="o d" onClick={()=>setAskCancel(true)}>Cancel registration</button>)}</>
    :my&&['Declined','Disqualified'].includes(my.status)?<span className="t x" style={{justifySelf:'start'}}>Your registration was not accepted</span>
    :!registrationOpen(e)?<button className="o" disabled>{closedLabel}</button>
    :<button className="p" onClick={()=>signedIn?openForm():setSignIn(true)}>{signedIn?(full?'Join waitlist':'Register'):'Sign in to register'}</button>}
   {notice&&<p role="status" className="m">{notice}</p>}{err&&!open&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}</div></div>
  {open&&<Modal onClose={()=>setOpen(false)}><form className="sheet" onSubmit={go}><button type="button" className="x" aria-label="Close" onClick={()=>setOpen(false)}>×</button><h2>{full?'Join waitlist':'Register'}</h2>
   {full&&<p className="m">This event is full. You will be added to the waitlist and moved up automatically if a spot opens.</p>}
   <input className="f" aria-label="Full name" placeholder="Full name" autoComplete="name" required minLength={2} maxLength={60} value={f.name} onChange={x=>setF({...f,name:x.target.value})}/>
   <input className="f" type="tel" aria-label="Phone" placeholder="Phone (shown to the organiser only)" autoComplete="tel" required value={f.phone} onChange={x=>setF({...f,phone:x.target.value})}/>
   <select className="f" aria-label="Club" value={f.club} onChange={x=>setF({...f,club:x.target.value})}><option value="">Independent</option>{clubs.filter(isApprovedClub).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
   {e.format==='Team'&&<input className="f" placeholder="Team name (optional)" aria-label="Team name (optional)" minLength={2} maxLength={40} value={f.team} onChange={x=>setF({...f,team:x.target.value})}/>}
   <label className="m"><input type="checkbox" required checked={f.ok} onChange={x=>setF({...f,ok:x.target.checked})}/> I accept the event rules</label>
   {err&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}<button className="p" disabled={busy}>{busy?'Registering…':full?'Join waitlist':'Register'}</button><p className="m">Your name is shown on the participant list. Your phone and email are only seen by the organiser. A confirmation will be emailed to you.</p></form></Modal>}</>}
export function MyPage(){
 const {user,events,toggleClub}=useApp();const {clubs}=useClubs();const {mine:myRegs,cancel,confirm}=useRegistrations();
 const myEv=useMyEvidence(Object.values(myRegs).filter(r=>['Accepted','On site'].includes(r.status)).map(r=>r.eventId));
 const [ev,setEv]=useState(''),[sp,setSp]=useState(SPECIES[0]),[ot,setOt]=useState(''),[file,setFile]=useState(null),[drop,setDrop]=useState(0),[gps,setGps]=useState(null),[sending,setSending]=useState(false),[evErr,setEvErr]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(''),[err,setErr]=useState('');
 if(!user)return <p>Please sign in to see your page.</p>;
 const mine=Object.values(myRegs).map(r=>({...r,e:events.find(x=>x.id===r.eventId)})).filter(r=>r.e&&r.status!=='Cancelled').sort((a,b)=>a.e.startsAt-b.e.startsAt),up=mine.filter(r=>!isPast(r.e)),past=mine.filter(r=>isPast(r.e));
 const counted=past.filter(r=>['Accepted','On site'].includes(r.status)),attended=counted.filter(r=>r.status==='On site').length;
 const act=async(id,fn)=>{setBusy(id);setErr('');try{await fn()}catch(x){setErr(x.message)}setBusy('')};
 const send=async x=>{x.preventDefault();if(!file||!ev)return;setSending(true);setEvErr('');
  try{await sendEvidence({uid:user.id,eventId:ev,blob:file,species:sp==='Other'?ot.trim()||'Other':sp,gps});setFile(null);setGps(null);setDrop(k=>k+1);setNote('Sent to the organiser.')}
  catch(e){setEvErr(e.message||'Could not send the photo. Please try again.')}
  setSending(false)};
 const pick=r=>{setNote('');setEvErr('');setFile(r?r.blob:null);setGps(r?r.gps:null)};
 return <div className="two"><div className="c" style={{display:'grid',gap:10}}><AvatarEditor/><h1 style={{fontSize:24}}>{user.name}</h1><span className="t" style={{justifySelf:'start'}}>{user.role}</span><b>Clubs</b>
  <div className="row">{clubs.filter(isApprovedClub).length?clubs.filter(isApprovedClub).map(c=><button key={c.id} className={'k'+(user.clubs.includes(c.id)?' on':'')} onClick={()=>toggleClub(c.id)}>{c.name}</button>):<span className="m">No clubs yet. <Link to="/clubs">Browse clubs</Link></span>}</div><b>Reliability</b><span className="m">Attended {attended} of {counted.length} registered events</span></div>
  <div style={{display:'grid',gap:16}}><div className="c"><h2>Upcoming</h2>{err&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}
   {up.map(r=>{const soon=r.status==='Accepted'&&daysTo(r.e)<=3,started=r.e.startsAt<=new Date(),open=['Accepted','Waitlist'].includes(r.status)&&!started;return <div className="li" key={r.eventId}><div className="g"><Link to={'/event/'+r.eventId}><b>{r.e.name}</b></Link><div className="m">{fmt(r.e)} · {r.e.waterbody}</div></div><span className={'t '+badge(r.status)}>{r.status}</span>
    {open&&soon&&(r.confirmed?<span className="t">Confirmed</span>:<button className="p" disabled={!!busy} onClick={()=>act(r.eventId,()=>confirm(r.eventId))}>I'm coming</button>)}
    {open&&<button className="o d" disabled={!!busy} onClick={()=>act(r.eventId,()=>cancel(r.eventId))}>{soon?"Can't come":'Cancel registration'}</button>}</div>})}{!up.length&&<p className="m">No upcoming events. <Link to="/">Find an event</Link></p>}</div>
   <div className="c"><h2>Past</h2>{past.map(r=><div className="li" key={r.eventId}><span className="g">{r.e.name}</span><span className="t n">{r.status}</span></div>)}{!past.length&&<p className="m">Nothing here yet.</p>}</div>
   <form className="c" onSubmit={send} style={{display:'grid',gap:10}}><h2>Send evidence</h2><div className="row"><select className="f" aria-label="Event" required value={ev} onChange={x=>setEv(x.target.value)}><option value="">Event…</option>{mine.filter(r=>['Accepted','On site'].includes(r.status)).map(r=><option key={r.eventId} value={r.eventId}>{r.e.name}</option>)}</select>
    <select className="f" aria-label="Species" value={sp} onChange={x=>setSp(x.target.value)}>{SPECIES.map(s=><option key={s}>{s}</option>)}</select>{sp==='Other'&&<input className="f" aria-label="Species name" placeholder="Species" value={ot} onChange={x=>setOt(x.target.value)}/>}</div>
    {ev&&<span className="m">Sent to: {events.find(x=>x.id===ev)?.ownerName}</span>}<EvidenceDrop key={drop} onChange={pick} disabled={sending}/>{note&&<span role="status" className="m">{note}</span>}{evErr&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{evErr}</p>}<button className="p" style={{justifySelf:'start'}} disabled={sending||!file}>{sending?'Sending…':'Send'}</button>
    {myEv.map(v=><div className="li" key={v.id}><EvidencePhoto path={v.photoPath} width={48} height={36}/><span className="g">{v.species}{v.weight!=null?` · ${v.weight} kg`:''}{v.status==='Rejected'&&v.reason&&<span className="m" style={{display:'block'}}>{v.reason}</span>}</span><span className={'t '+badge(v.status)}>{v.status}</span></div>)}</form></div></div>}
const OPEN_STATUSES=['Accepted','On site','Waitlist'],CLOSED_STATUSES=['Cancelled','Declined','Disqualified'];
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
export function Manage(){
 const {user,events}=useApp();const {clubs}=useClubs();const {setStatus}=useRegistrations();
 const mine=user?events.filter(e=>['admin','superadmin'].includes(user.role)||e.org===user.id):[];
 const [id,setId]=useState(''),[tab,setTab]=useState('Applications'),[w,setW]=useState({}),[show,setShow]=useState('open'),[busy,setBusy]=useState(''),[err,setErr]=useState(''),[why,setWhy]=useState({}),[redo,setRedo]=useState({});
 const e=mine.find(x=>x.id===id)||mine[0];
 const {list,loading:listLoading}=useEventRegistrations(e?.id,{enabled:!!e&&!!user&&user.role!=='participant',withContacts:true});
 const {list:ev,error:evError}=useEventEvidence(e?.id,{enabled:!!e&&!!user&&user.role!=='participant'});
 if(!user||user.role==='participant')return <p>Organisers only.</p>;
 if(!e)return <div className="c" style={{display:'grid',gap:10}}><p>You have no events yet.</p><Link className="p btn" to="/event/new" style={{justifySelf:'start'}}>Create event</Link></div>;
 const rows=list.filter(r=>show==='all'||(show==='open'?OPEN_STATUSES.includes(r.status):CLOSED_STATUSES.includes(r.status)));
 const score={};ev.filter(v=>v.status==='Approved').forEach(v=>score[v.userName]=(score[v.userName]||0)+Number(v.weight||0));
 const club=r=>clubs.find(c=>c.id===r.clubId)?.name||'';
 const decide=async(v,status)=>{setBusy(v.id);setErr('');try{await reviewEvidence(e.id,v.id,status==='Approved'?{status,weight:w[v.id]??''}:{status,reason:why[v.id]||''});setRedo(r=>({...r,[v.id]:false}))}catch(x){setErr(x.message)}setBusy('')};
 const change=async(r,status)=>{setBusy(r.id);setErr('');try{await setStatus(e.id,r.id,status)}catch(x){setErr(x.message)}setBusy('')};
 const csv=()=>{const head=['Name','Team','Club','Phone','Email','Status','Registered'],body=list.map(r=>[r.name,r.teamName,club(r),r.phone,r.email,r.status,r.createdAt?r.createdAt.toISOString():'']);const b=new Blob([[head,...body].map(r=>r.map(csvCell).join(',')).join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=e.name.replace(/[^\w]+/g,'-')+'-registrations.csv';a.click()};
 return <><div className="row" style={{justifyContent:'space-between'}}><div><span className="t">Organiser</span><h1 style={{marginTop:8}}>{e.name}</h1></div><div className="row"><select className="f" aria-label="Event" value={e.id} onChange={x=>setId(x.target.value)}>{mine.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>{tab==='Applications'&&<button className="o" onClick={csv}>Export CSV</button>}<Link className="o btn" to={'/event/'+e.id+'/edit'}>Edit event</Link><Link className="p btn" to="/event/new">Create event</Link></div></div>
  <div className="tb">{['Applications','Evidence','Scores'].map(t=><button key={t} className={tab===t?'on':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
  {tab==='Applications'&&<div className="c"><div className="row" style={{justifyContent:'space-between',marginBottom:10}}><span role="status"><b>{e.counts?.accepted||0}</b> of {e.limit} spots filled · <b>{e.counts?.waitlist||0}</b> on the waitlist</span>
    <select className="f" aria-label="Show" value={show} onChange={x=>setShow(x.target.value)}><option value="open">Accepted and waitlist</option><option value="closed">Cancelled, declined, disqualified</option><option value="all">Everyone</option></select></div>
   {err&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}
   <div className="sc"><table><thead><tr className="m"><th>Participant</th><th>Contact</th><th>Registered</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.name}</b><div className="m">{[r.teamName&&'Team '+r.teamName,club(r)].filter(Boolean).join(' · ')}</div></td>
    <td className="m">{r.phone&&<div><a href={'tel:'+r.phone}>{r.phone}</a></div>}{r.email&&<div style={{overflowWrap:'anywhere'}}>{r.email}</div>}</td><td className="m">{r.createdAt?r.createdAt.toLocaleDateString('en-NZ',{day:'numeric',month:'short'}):''}</td>
    <td>{r.status==='Cancelled'?<span className="t n">Cancelled</span>:<select className="f" aria-label={'Status for '+r.name} value={r.status} disabled={busy===r.id} onChange={x=>change(r,x.target.value)}>{['Accepted','Waitlist','On site','Disqualified','Declined'].map(s=><option key={s}>{s}</option>)}</select>}</td></tr>)}</tbody></table></div>
   {listLoading&&<p className="m">Loading…</p>}{!listLoading&&!rows.length&&<p className="m" style={{padding:'12px 0'}}>{show==='open'?'Nobody has registered yet.':'Nothing to show.'}</p>}</div>}
  {tab==='Evidence'&&<div className="c"><p className="m" style={{marginBottom:8}}>Locations come from the data inside the photo. They help check where it was taken, but photo data can be edited, so treat a location as a hint.</p>
   {(err||evError)&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err||evError}</p>}
   {ev.map(v=>{const open=v.status==='Pending'||redo[v.id],reason=(why[v.id]||'').trim();return <div className="li" key={v.id} style={{alignItems:'flex-start',flexWrap:'wrap'}}><EvidencePhoto path={v.photoPath} width={64} height={48}/><div className="g"><b>{v.userName}</b><div className="m">{v.species}{v.createdAt?' · '+v.createdAt.toLocaleString('en-NZ',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Pacific/Auckland'}):''}</div><div><PhotoLocation item={v}/></div></div>
    {open?<div className="row" style={{width:'100%'}}><input className="f" style={{width:90}} inputMode="decimal" aria-label={'Weight (kg) for '+v.userName} placeholder="kg" value={w[v.id]??''} onChange={x=>setW({...w,[v.id]:x.target.value})}/><button className="p" disabled={busy===v.id} onClick={()=>decide(v,'Approved')}>Approve</button>
     <input className="f" style={{flex:1,minWidth:140}} aria-label={'Reason for rejecting '+v.userName+"'s photo"} placeholder="Reason, if rejecting" maxLength={300} value={why[v.id]||''} onChange={x=>setWhy({...why,[v.id]:x.target.value})}/><button className="o d" disabled={busy===v.id||reason.length<3} onClick={()=>decide(v,'Rejected')}>Reject</button></div>
     :<div className="row"><span className={'t '+badge(v.status)}>{v.status}{v.weight!=null?` · ${v.weight} kg`:''}</span>{v.status==='Rejected'&&v.reason&&<span className="m">{v.reason}</span>}<button className="o" onClick={()=>{setW({...w,[v.id]:v.weight??''});setWhy({...why,[v.id]:v.reason||''});setRedo({...redo,[v.id]:true})}}>Change</button></div>}</div>})}
   {!ev.length&&<p className="m">No evidence yet. Participants send photos from their My page.</p>}</div>}
  {tab==='Scores'&&<div className="c">{Object.entries(score).sort((a,b)=>b[1]-a[1]).map(([n,s],i)=><div className="li" key={n}><b>{i+1}</b><span className="g">{n}</span><span>{s} kg</span></div>)}{!Object.keys(score).length&&<p className="m">Approved catches will be ranked here.</p>}</div>}</>}

export function Admin(){const {user}=useApp();const {clubs}=useClubs();const {events}=useEvents();const n=pendingCount(clubs,events);const [tab,setTab]=useState('Users');
 if(!['admin','superadmin'].includes(user?.role))return <p>Admins only.</p>;
 return <><h1>Admin</h1><div className="tb">{['Users','Approvals','Clubs & events',...(user.role==='superadmin'?['Placeholders']:[])].map(t=><button key={t} className={tab===t?'on':''} onClick={()=>setTab(t)}>{t==='Approvals'?<span className="nl">{t}<PendingBadge n={n}/></span>:t}</button>)}</div>{tab==='Users'?<Users/>:tab==='Approvals'?<Approvals/>:tab==='Clubs & events'?<Cleanup/>:<PlaceholderSettings/>}</>}
