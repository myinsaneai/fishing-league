import {useCallback,useEffect,useMemo,useState} from 'react';
import {call} from './firebase';
import {useApp} from './store';
import Avatar from './Avatar';
const ROLES=['participant','organiser','admin','superadmin'];
const PROV={'google.com':'Google',password:'Email'};
const date=s=>s?new Date(s).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}):'Never';
export function Users(){
 const {user}=useApp();
 const [users,setUsers]=useState(null),[err,setErr]=useState(''),[q,setQ]=useState(''),[fr,setFr]=useState(''),[fs,setFs]=useState('');
 const load=useCallback(async()=>{setErr('');try{const r=await call('listUsers')();setUsers(r.data.users)}catch(e){setErr(e.message);setUsers([])}},[]);
 useEffect(()=>{load()},[load]);
 const canSet=user.role==='superadmin'?ROLES:ROLES.slice(0,2);
 const list=useMemo(()=>(users||[]).filter(u=>(!fr||u.role===fr)&&(!fs||(fs==='disabled')===u.disabled)&&(u.name+' '+u.email).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>ROLES.indexOf(b.role)-ROLES.indexOf(a.role)||(a.name||a.email).localeCompare(b.name||b.email)),[users,q,fr,fs]);
 const saved=r=>setUsers(l=>l.map(x=>x.uid===r.uid?{...x,role:r.role,disabled:r.disabled}:x));
 return <div className="c">
  <div className="row" style={{marginBottom:12}}><input className="f" placeholder="Search name or email" aria-label="Search users" value={q} onChange={e=>setQ(e.target.value)} style={{flex:'1 1 220px'}}/>
   <select className="f" aria-label="Filter by role" value={fr} onChange={e=>setFr(e.target.value)}><option value="">All roles</option>{ROLES.map(r=><option key={r}>{r}</option>)}</select>
   <select className="f" aria-label="Filter by status" value={fs} onChange={e=>setFs(e.target.value)}><option value="">Any status</option><option value="active">Active</option><option value="disabled">Disabled</option></select>
   <button className="o" onClick={load}>Refresh</button></div>
  <p className="m" style={{marginBottom:8}}>{users?`${list.length} of ${users.length} users`:'Loading users…'} · Role and status changes apply when the person next signs in, or within an hour.</p>
  {err&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{err}</p>}
  <div className="uh"><div className="c1">User</div><div className="c2">Sign-in</div><div className="c3">Role</div><div className="c4">Status</div><div className="c5">Last sign-in</div><div className="c6"></div></div>
  {list.map(u=><Row key={u.uid} u={u} me={user.role} self={u.email&&u.email===user.email} canSet={canSet} onSaved={saved}/>)}
  {users&&!list.length&&!err&&<p className="m" style={{paddingTop:12}}>No users match.</p>}</div>}
function Row({u,me,self,canSet,onSaved}){
 const [edit,setEdit]=useState(false),[role,setRole]=useState(u.role),[off,setOff]=useState(u.disabled),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const locked=self||(me!=='superadmin'&&ROLES.indexOf(u.role)>1);
 const save=async()=>{setBusy(true);setMsg('');try{const r=await call('updateUser')({uid:u.uid,role,disabled:off});onSaved(r.data);setEdit(false)}catch(e){setMsg(e.message)}setBusy(false)};
 const cancel=()=>{setEdit(false);setRole(u.role);setOff(u.disabled);setMsg('')};
 return <div className="ur">
  <div className="c1" style={{display:'flex',gap:10,alignItems:'center'}}><Avatar url={u.photo} name={u.name||u.email} size={36}/><div style={{minWidth:0}}><b style={{display:'block',overflow:'hidden',textOverflow:'ellipsis'}}>{u.name||u.email}</b><span className="m" style={{overflowWrap:'anywhere'}}>{u.email}</span></div></div>
  <div className="c2"><span className="lb">Sign-in</span><div className="row" style={{gap:4}}>{u.providers.map(p=><span key={p} className="t n">{PROV[p]||p}</span>)}{!u.verified&&<span className="t a">Unverified</span>}</div></div>
  <div className="c3"><span className="lb">Role</span>{edit?<select className="f" aria-label={'Role for '+(u.name||u.email)} value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(r=><option key={r} disabled={!canSet.includes(r)}>{r}</option>)}</select>:<span className="t">{u.role}</span>}</div>
  <div className="c4"><span className="lb">Status</span>{edit?<select className="f" aria-label={'Status for '+(u.name||u.email)} value={off?'disabled':'active'} onChange={e=>setOff(e.target.value==='disabled')}><option value="active">Active</option><option value="disabled">Disabled</option></select>:<span className={'t '+(u.disabled?'x':'')}>{u.disabled?'Disabled':'Active'}</span>}</div>
  <div className="c5"><span className="lb">Last sign-in</span><span className="m">{date(u.lastSignIn)}</span></div>
  <div className="c6">{self?<span className="m">You</span>:locked?<span className="m">Superadmin only</span>:edit?<><button className="p" disabled={busy} onClick={save}>Save</button><button className="o" disabled={busy} onClick={cancel}>Cancel</button></>:<button className="o" onClick={()=>setEdit(true)}>Edit</button>}</div>
  {msg&&<p role="alert" className="m" style={{flex:'1 1 100%',color:'#A33A2B'}}>{msg}</p>}</div>}
