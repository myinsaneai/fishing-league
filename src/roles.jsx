import {useCallback,useEffect,useState} from 'react';
import {collection,getDocs,query,where} from 'firebase/firestore';
import {db,call} from './firebase';
import {useAuth} from './auth';
import {useApp} from './store';
export function Roles(){
 const {user}=useApp();const [email,setEmail]=useState(''),[role,setRole]=useState('organiser'),[msg,setMsg]=useState(''),[staff,setStaff]=useState([]);
 const load=useCallback(async()=>{try{const s=await getDocs(query(collection(db,'users'),where('role','in',['organiser','admin','superadmin'])));setStaff(s.docs.map(d=>({id:d.id,...d.data()})))}catch{setStaff([])}},[]);
 useEffect(()=>{load()},[load]);
 const opts=user.role==='superadmin'?['participant','organiser','admin','superadmin']:['participant','organiser'];
 const save=async e=>{e.preventDefault();setMsg('');try{const r=await call('setUserRole')({email,role});setMsg(`${r.data.email} is now ${r.data.role}.`);setEmail('');load()}catch(x){setMsg(x.message)}};
 return <div className="c" style={{display:'grid',gap:12,marginBottom:16}}><h2>Roles</h2>
  <form className="row" onSubmit={save}><input className="f" type="email" required placeholder="User email" aria-label="User email" value={email} onChange={e=>setEmail(e.target.value)}/><select className="f" aria-label="Role" value={role} onChange={e=>setRole(e.target.value)}>{opts.map(o=><option key={o}>{o}</option>)}</select><button className="p">Set role</button></form>
  <p className="m">The person must have signed in at least once.</p>{msg&&<p role="status">{msg}</p>}
  {staff.map(s=><div className="li" key={s.id}><div className="g">{s.displayName||s.email}<div className="m">{s.email}</div></div><span className="t">{s.role}</span></div>)}</div>}
