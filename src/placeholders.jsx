import {createContext,useContext,useEffect,useState} from 'react';
import {doc,onSnapshot,serverTimestamp,setDoc} from 'firebase/firestore';
import {deleteObject,getDownloadURL,ref as sRef,uploadBytes} from 'firebase/storage';
import {db,storage} from './firebase';
// Fallback pictures shown when a club, event or profile has no image, or its image cannot be loaded.
// A superadmin manages them (Admin > Placeholders); everyone can read them.
export const KINDS=['avatar','club','event'];
const empty={avatar:'',club:'',event:''};
const Ctx=createContext({placeholders:empty,savePlaceholder:async()=>{}});
export const usePlaceholders=()=>useContext(Ctx).placeholders;
export const usePlaceholderApi=()=>useContext(Ctx);
export function PlaceholdersProvider({children}){
 const [p,setP]=useState(empty);
 useEffect(()=>onSnapshot(doc(db,'settings','placeholders'),
  s=>{const d=s.data?.()||{};setP({avatar:d.avatar||'',club:d.club||'',event:d.event||''})},()=>{}),[]);
 const savePlaceholder=async(kind,{file,remove},user)=>{
  const ref=doc(db,'settings','placeholders'),img=sRef(storage,`placeholders/${kind}`);
  if(file){await uploadBytes(img,file,{contentType:file.type});await setDoc(ref,{[kind]:await getDownloadURL(img),updatedAt:serverTimestamp()},{merge:true})}
  else if(remove){try{await deleteObject(img)}catch{}await setDoc(ref,{[kind]:'',updatedAt:serverTimestamp()},{merge:true})}
 };
 return <Ctx.Provider value={{placeholders:p,savePlaceholder}}>{children}</Ctx.Provider>}
