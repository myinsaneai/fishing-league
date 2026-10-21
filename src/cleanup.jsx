import {useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useClubs} from './clubsStore';
import {useEvents} from './eventsStore';
import DeleteDialog from './deletion';
const date=d=>d?d.toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}):'';
const LABEL={pending:'Pending approval',rejected:'Not approved',approved:'Approved',published:'Published',draft:'Draft',cancelled:'Cancelled'};
const KINDS=[['event','Events'],['club','Clubs']];
// Admin tab for removing clubs and events for good (test data, mistakes). Pick one or many; the dialog shows what goes with them.
export function Cleanup(){
 const {clubs}=useClubs(),{events}=useEvents();
 const [kind,setKind]=useState('event'),[q,setQ]=useState(''),[sel,setSel]=useState({}),[dlg,setDlg]=useState(null);
 const all=kind==='club'?clubs:events;
 const list=useMemo(()=>all.filter(i=>(i.name+' '+(i.ownerName||'')).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(b.createdAt?.getTime?.()||0)-(a.createdAt?.getTime?.()||0)),[all,q]);
 const chosen=list.filter(i=>sel[i.id]),allOn=list.length>0&&chosen.length===list.length;
 const word=kind==='club'?'club':'event';
 const open=items=>setDlg(items.map(i=>({id:i.id,label:i.name})));
 const switchKind=k=>{setKind(k);setSel({});setQ('')};
 return <div className="c">
  <p className="m" style={{marginBottom:10}}>Delete clubs and events for good, for example test data. Everything that belongs to them is removed too (registrations, evidence, pictures). This cannot be undone.</p>
  <div className="sub" role="tablist" aria-label="What to delete">{KINDS.map(([k,l])=><button key={k} role="tab" aria-selected={kind===k} className={kind===k?'on':''} onClick={()=>switchKind(k)}><span className="nl">{l}<span className="bdg zero" aria-hidden="true">{(k==='club'?clubs:events).length}</span></span></button>)}</div>
  <div className="row" style={{marginBottom:10}}><input className="f" style={{flex:'1 1 220px'}} placeholder={`Search ${word}s by name or owner`} aria-label={`Search ${word}s`} value={q} onChange={e=>setQ(e.target.value)}/>
   <label className="m" style={{display:'flex',gap:6,alignItems:'center'}}><input type="checkbox" checked={allOn} onChange={e=>setSel(e.target.checked?Object.fromEntries(list.map(i=>[i.id,true])):{})}/>Select all shown</label>
   <button className="o d" disabled={!chosen.length} onClick={()=>open(chosen)}>Delete selected{chosen.length?` (${chosen.length})`:''}</button></div>
  {list.map(i=><div className="li" key={i.id}>
   <input type="checkbox" aria-label={`Select ${i.name}`} checked={!!sel[i.id]} onChange={e=>setSel({...sel,[i.id]:e.target.checked})}/>
   <div className="g"><Link to={kind==='club'?'/clubs/'+i.id:'/event/'+i.id}><b>{i.name}</b></Link><div className="m">{i.ownerName||'Unknown owner'} · {kind==='club'?'created ':'starts '}{date(kind==='club'?i.createdAt:i.startsAt)}</div></div>
   <span className="t n">{LABEL[i.status||'approved']||i.status}</span>
   <button className="o d" aria-label={`Delete ${i.name}`} onClick={()=>open([i])}>Delete…</button></div>)}
  {!list.length&&<p className="m" style={{padding:'12px 0'}}>{all.length?`No ${word}s match.`:`There are no ${word}s.`}</p>}
  {dlg&&<DeleteDialog kind={kind} items={dlg} onClose={()=>setDlg(null)} onDeleted={ids=>setSel(s=>{const x={...s};ids.forEach(id=>delete x[id]);return x})}/>}</div>}
