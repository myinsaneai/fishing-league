import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {collection,onSnapshot} from 'firebase/firestore';
import {db,call} from './firebase';
import {useAuth} from './auth';
// Registrations are only ever changed by Cloud Functions (so the spot limit and waitlist are enforced on the server).
// This provider listens to the signed-in person's own registrations and offers the calls.
const none={mine:{},loading:false,register:async()=>{throw new Error('Sign in to register.')},cancel:async()=>{},confirm:async()=>{},setStatus:async()=>{}};
const Ctx=createContext(none);
export const useRegistrations=()=>useContext(Ctx);
const run=(name,data)=>call(name)(data).then(r=>r.data);
export function RegistrationsProvider({children}){
 const {user}=useAuth(),uid=user?.id;
 const [mine,setMine]=useState({}),[loading,setLoading]=useState(false);
 useEffect(()=>{
  if(!uid){setMine({});setLoading(false);return}
  setLoading(true);
  return onSnapshot(collection(db,'users',uid,'registrations'),
   s=>{const m={};s.docs.forEach(d=>{const x=d.data();m[d.id]={...x,eventId:d.id,createdAt:x.createdAt?.toDate?.()||null}});setMine(m);setLoading(false)},
   ()=>setLoading(false));
 },[uid]);
 const api=useMemo(()=>({mine,loading,
  register:d=>run('registerForEvent',d),cancel:eventId=>run('cancelRegistration',{eventId}),confirm:eventId=>run('confirmAttendance',{eventId}),
  setStatus:(eventId,uid,status)=>run('setRegistrationStatus',{eventId,uid,status})}),[mine,loading]);
 return <Ctx.Provider value={api}>{children}</Ctx.Provider>}
// Everyone registered for an event, by order of registering. The public part is names only;
// with withContacts (organisers and admins) the phone number and email are added.
export function useEventRegistrations(eventId,{enabled=true,withContacts=false}={}){
 const [pub,setPub]=useState(null),[priv,setPriv]=useState({}),[error,setError]=useState('');
 useEffect(()=>{
  if(!enabled||!eventId){setPub(null);return}
  setPub(null);
  return onSnapshot(collection(db,'events',eventId,'registrations'),
   s=>setPub(s.docs.map(d=>{const x=d.data();return {...x,id:d.id,createdAt:x.createdAt?.toDate?.()||null}})),
   e=>{setError(e.message);setPub([])});
 },[eventId,enabled]);
 useEffect(()=>{
  if(!enabled||!withContacts||!eventId){setPriv({});return}
  return onSnapshot(collection(db,'events',eventId,'registrationPrivate'),s=>{const m={};s.docs.forEach(d=>{m[d.id]=d.data()});setPriv(m)},()=>{});
 },[eventId,enabled,withContacts]);
 const list=useMemo(()=>(pub||[]).map(r=>({...r,phone:priv[r.id]?.phone||'',email:priv[r.id]?.email||''})).sort((a,b)=>(a.order||0)-(b.order||0)),[pub,priv]);
 return {list,loading:enabled&&pub===null,error};
}
