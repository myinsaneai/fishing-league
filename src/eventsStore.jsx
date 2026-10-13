import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {collection,doc,onSnapshot,query,serverTimestamp,setDoc,updateDoc,where} from 'firebase/firestore';
import {deleteObject,getDownloadURL,ref as sRef,uploadBytes} from 'firebase/storage';
import {db,storage} from './firebase';
import {useAuth} from './auth';
import {nzDate} from './data';
const Ctx=createContext({events:[],loading:false,error:'',saveEvent:async()=>({})});
export const useEvents=()=>useContext(Ctx);
const ORGANISERS=['organiser','admin','superadmin'],ADMINS=['admin','superadmin'];
// Adds the fields the screens use: a real Date, an NZ calendar date, and short aliases.
const norm=(id,d)=>{
 const startsAt=d.startsAt?.toDate?.()||null;
 return {...d,id,startsAt,endsAt:d.endsAt?.toDate?.()||null,createdAt:d.createdAt?.toDate?.()||null,reviewedAt:d.reviewedAt?.toDate?.()||null,date:startsAt?nzDate(startsAt):'',water:d.waterType,disc:d.discipline,otherLabel:d.disciplineOther||'',org:d.ownerId,club:d.clubId||''};
};
export function EventsProvider({children}){
 const {user}=useAuth();
 const [pub,setPub]=useState(null),[own,setOwn]=useState([]),[error,setError]=useState('');
 const uid=user?.id,role=user?.role;
 // Everyone sees published and cancelled events.
 useEffect(()=>onSnapshot(query(collection(db,'events'),where('status','in',['published','cancelled'])),
  s=>setPub(s.docs.map(d=>norm(d.id,d.data()))),
  e=>{setError('Could not load events: '+e.message);setPub([])}),[]);
 // Organisers also see their own drafts; admins see everything.
 useEffect(()=>{
  if(!uid||!ORGANISERS.includes(role)){setOwn([]);return}
  const q=ADMINS.includes(role)?collection(db,'events'):query(collection(db,'events'),where('ownerId','==',uid));
  return onSnapshot(q,s=>setOwn(s.docs.map(d=>norm(d.id,d.data()))),()=>setOwn([]));
 },[uid,role]);
 const events=useMemo(()=>{
  const m=new Map();(pub||[]).forEach(e=>m.set(e.id,e));own.forEach(e=>m.set(e.id,e));
  return [...m.values()].sort((a,b)=>(a.startsAt?.getTime()||0)-(b.startsAt?.getTime()||0));
 },[pub,own]);
 // Saves the event first, then the photo (the Storage rules look the event up to check ownership).
 const saveEvent=async({id,data,file,removeImage,user})=>{
  const ref=id?doc(db,'events',id):doc(collection(db,'events'));
  if(id)await updateDoc(ref,{...data,updatedAt:serverTimestamp()});
  else await setDoc(ref,{...data,coverUrl:'',ownerId:user.id,ownerName:user.name,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  let imageError='';
  try{
   const img=sRef(storage,`events/${ref.id}/cover`);
   if(file){await uploadBytes(img,file,{contentType:file.type});await updateDoc(ref,{coverUrl:await getDownloadURL(img),updatedAt:serverTimestamp()})}
   else if(removeImage){try{await deleteObject(img)}catch{}await updateDoc(ref,{coverUrl:'',updatedAt:serverTimestamp()})}
  }catch(e){imageError=e.message}
  return {id:ref.id,imageError};
 };
 return <Ctx.Provider value={{events,loading:pub===null,error,saveEvent}}>{children}</Ctx.Provider>}
