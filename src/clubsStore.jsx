import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {collection,doc,onSnapshot,query,serverTimestamp,setDoc,updateDoc,where} from 'firebase/firestore';
import {deleteObject,getDownloadURL,ref as sRef,uploadBytes} from 'firebase/storage';
import {db,storage} from './firebase';
import {useAuth} from './auth';
const Ctx=createContext({clubs:[],loading:false,error:'',saveClub:async()=>({})});
export const useClubs=()=>useContext(Ctx);
// Clubs created before approvals existed have no status; they count as approved once an admin marks them so.
export const isApprovedClub=c=>(c.status||'approved')==='approved';
const ORGANISERS=['organiser','admin','superadmin'],ADMINS=['admin','superadmin'];
const norm=(id,d)=>({...d,id,createdAt:d.createdAt?.toDate?.()||null,reviewedAt:d.reviewedAt?.toDate?.()||null});
export function ClubsProvider({children}){
 const {user}=useAuth();
 const [pub,setPub]=useState(null),[own,setOwn]=useState([]),[error,setError]=useState('');
 const uid=user?.id,role=user?.role;
 // Everyone sees approved clubs.
 useEffect(()=>onSnapshot(query(collection(db,'clubs'),where('status','==','approved')),
  s=>setPub(s.docs.map(d=>norm(d.id,d.data()))),
  e=>{setError('Could not load clubs: '+e.message);setPub([])}),[]);
 // Organisers also see their own clubs (including pending and rejected); admins see everything.
 useEffect(()=>{
  if(!uid||!ORGANISERS.includes(role)){setOwn([]);return}
  const q=ADMINS.includes(role)?collection(db,'clubs'):query(collection(db,'clubs'),where('ownerId','==',uid));
  return onSnapshot(q,s=>setOwn(s.docs.map(d=>norm(d.id,d.data()))),()=>setOwn([]));
 },[uid,role]);
 const clubs=useMemo(()=>{
  const m=new Map();(pub||[]).forEach(c=>m.set(c.id,c));own.forEach(c=>m.set(c.id,c));
  return [...m.values()].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
 },[pub,own]);
 // New clubs start as pending (admins' own clubs are approved). A rejected club goes back to pending when its owner saves it.
 const saveClub=async({id,data,file,removeImage,user,resubmit})=>{
  const ref=id?doc(db,'clubs',id):doc(collection(db,'clubs'));
  if(id)await updateDoc(ref,{...data,...(resubmit?{status:'pending'}:{}),updatedAt:serverTimestamp()});
  else await setDoc(ref,{...data,status:ADMINS.includes(user.role)?'approved':'pending',coverUrl:'',ownerId:user.id,ownerName:user.name,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  let imageError='';
  try{
   const img=sRef(storage,`clubs/${ref.id}/cover`);
   if(file){await uploadBytes(img,file,{contentType:file.type});await updateDoc(ref,{coverUrl:await getDownloadURL(img),updatedAt:serverTimestamp()})}
   else if(removeImage){try{await deleteObject(img)}catch{}await updateDoc(ref,{coverUrl:'',updatedAt:serverTimestamp()})}
  }catch(e){imageError=e.message}
  return {id:ref.id,imageError};
 };
 return <Ctx.Provider value={{clubs,loading:pub===null,error,saveClub}}>{children}</Ctx.Provider>}
