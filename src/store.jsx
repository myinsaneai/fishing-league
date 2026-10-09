import {createContext,useContext,useState} from 'react';
import {EVENTS,REGS,ACTIVE} from './data';
const Ctx=createContext();
export const useApp=()=>useContext(Ctx);
export function AppProvider({children}){
 const [user,setUser]=useState(null),[signIn,setSignIn]=useState(false),[regs,setRegs]=useState(REGS),[evidence,setEvidence]=useState([]),events=EVENTS;
 const cnt=(l,id)=>l.filter(r=>r.eventId===id&&ACTIVE.includes(r.status)).length;
 const taken=id=>cnt(regs,id);
 const fill=l=>{let out=[...l];events.forEach(e=>{let n=cnt(out,e.id);out=out.map(r=>{if(n<e.limit&&r.eventId===e.id&&r.status==='Waitlist'){n++;return {...r,status:'Accepted'}}return r})});return out};
 const register=(eventId,extra={})=>setRegs(l=>l.some(r=>r.eventId===eventId&&r.userId===user.id)?l:[...l,{id:'r'+Date.now(),eventId,userId:user.id,name:user.name,status:cnt(l,eventId)<events.find(e=>e.id===eventId).limit?'Accepted':'Waitlist',...extra}]);
 const setStatus=(id,status)=>setRegs(l=>fill(l.map(r=>r.id===id?{...r,status}:r)));
 const cancel=id=>setRegs(l=>fill(l.filter(r=>r.id!==id)));
 const addEvidence=ev=>setEvidence(l=>[...l,{id:'v'+Date.now(),status:'Pending',...ev}]);
 const review=(id,status,weight)=>setEvidence(l=>l.map(v=>v.id===id?{...v,status,weight}:v));
 const toggleClub=id=>setUser(u=>({...u,clubs:u.clubs.includes(id)?u.clubs.filter(c=>c!==id):[...u.clubs,id]}));
 return <Ctx.Provider value={{user,setUser,signIn,setSignIn,regs,evidence,events,taken,register,setStatus,cancel,addEvidence,review,toggleClub}}>{children}</Ctx.Provider>}
