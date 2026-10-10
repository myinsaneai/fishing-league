import {createContext,useContext,useEffect,useState} from 'react';
import {collection,doc,onSnapshot,orderBy,query,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore';
import {deleteObject,getDownloadURL,ref as sRef,uploadBytes} from 'firebase/storage';
import {db,storage} from './firebase';
const Ctx=createContext({clubs:[],loading:false,error:'',saveClub:async()=>({})});
export const useClubs=()=>useContext(Ctx);
export function ClubsProvider({children}){
 const [clubs,setClubs]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>onSnapshot(query(collection(db,'clubs'),orderBy('name')),
  s=>{setClubs(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false)},
  e=>{setError('Could not load clubs: '+e.message);setLoading(false)}),[]);
 // Saves the club first, then the cover image (the Storage rules look the club up to check ownership).
 const saveClub=async({id,data,file,removeImage,user})=>{
  const ref=id?doc(db,'clubs',id):doc(collection(db,'clubs'));
  if(id)await updateDoc(ref,{...data,updatedAt:serverTimestamp()});
  else await setDoc(ref,{...data,coverUrl:'',ownerId:user.id,ownerName:user.name,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  let imageError='';
  try{
   const img=sRef(storage,`clubs/${ref.id}/cover`);
   if(file){await uploadBytes(img,file,{contentType:file.type});await updateDoc(ref,{coverUrl:await getDownloadURL(img),updatedAt:serverTimestamp()})}
   else if(removeImage){try{await deleteObject(img)}catch{}await updateDoc(ref,{coverUrl:'',updatedAt:serverTimestamp()})}
  }catch(e){imageError=e.message}
  return {id:ref.id,imageError};
 };
 return <Ctx.Provider value={{clubs,loading,error,saveClub}}>{children}</Ctx.Provider>}
