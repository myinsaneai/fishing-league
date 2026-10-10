import {createContext,useContext,useEffect,useState} from 'react';
import {doc,updateDoc,arrayUnion,arrayRemove} from 'firebase/firestore';
import {db} from './firebase';
import {EVENTS,REGS,ACTIVE} from './data';
import {useAuth} from './auth';
const Ctx=createContext();
export const useApp=()=>useContext(Ctx);
export function AppProvider({children}){
 const {user:au,out}=useAuth();
 const [demo,setUser]=useState(null),[myClubs,setMyClubs]=useState([]),[signIn,setSignIn]=useState(false),[regs,setRegs]=useState(REGS),[evidence,setEvidence]=useState([]),events=EVENTS;
 const user=au?{...au,clubs:myClubs}:demo,real=!!au,logout=()=>{setUser(null);out()};
 useEffect(()=>{setMyClubs(au?.clubIds||[])},[au?.id]);
 const cnt=(l,id)=>l.filter(r=>r.eventId===id&&ACTIVE.includes(r.status)).length;
 const taken=id=>cnt(regs,id);
 const fill=l=>{let out=[...l];events.forEach(e=>{let n=cnt(out,e.id);out=out.map(r=>{if(n<e.limit&&r.eventId===e.id&&r.status==='Waitlist'){n++;return {...r,status:'Accepted'}}return r})});return out};
 const register=(eventId,extra={})=>setRegs(l=>l.some(r=>r.eventId===eventId&&r.userId===user.id)?l:[...l,{id:'r'+Date.now(),eventId,userId:user.id,name:user.name,status:cnt(l,eventId)<events.find(e=>e.id===eventId).limit?'Accepted':'Waitlist',...extra}]);
 const setStatus=(id,status)=>setRegs(l=>fill(l.map(r=>r.id===id?{...r,status}:r)));
 const cancel=id=>setRegs(l=>fill(l.filter(r=>r.id!==id)));
 const addEvidence=ev=>setEvidence(l=>[...l,{id:'v'+Date.now(),status:'Pending',...ev}]);
 const review=(id,status,weight)=>setEvidence(l=>l.map(v=>v.id===id?{...v,status,weight}:v));
 const toggleClub=id=>{const has=(user?.clubs||[]).includes(id),t=c=>c.includes(id)?c.filter(x=>x!==id):[...c,id];if(!au){setUser(u=>({...u,clubs:t(u.clubs)}));return}setMyClubs(t);updateDoc(doc(db,'users',au.id),{clubIds:has?arrayRemove(id):arrayUnion(id)}).catch(e=>{console.warn(e);setMyClubs(c=>has?[...c,id]:c.filter(x=>x!==id))})};
 return <Ctx.Provider value={{real,logout,user,setUser,signIn,setSignIn,regs,evidence,events,taken,register,setStatus,cancel,addEvidence,review,toggleClub}}>{children}</Ctx.Provider>}
