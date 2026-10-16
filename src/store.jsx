import {createContext,useContext,useEffect,useState} from 'react';
import {doc,updateDoc,arrayUnion,arrayRemove} from 'firebase/firestore';
import {db} from './firebase';
import {useEvents} from './eventsStore';
import {useAuth} from './auth';
const Ctx=createContext();
export const useApp=()=>useContext(Ctx);
export function AppProvider({children}){
 const {user:au,out}=useAuth();
 const [demo,setUser]=useState(null),[myClubs,setMyClubs]=useState([]),[signIn,setSignIn]=useState(false),{events}=useEvents();
 const user=au?{...au,clubs:myClubs}:demo,real=!!au,logout=()=>{setUser(null);out()};
 useEffect(()=>{setMyClubs(au?.clubIds||[])},[au?.id]);
 // Spots taken come from the counts the registration functions keep on each event.
 const taken=id=>events.find(e=>e.id===id)?.counts?.accepted||0;
 const toggleClub=id=>{const has=(user?.clubs||[]).includes(id),t=c=>c.includes(id)?c.filter(x=>x!==id):[...c,id];if(!au){setUser(u=>({...u,clubs:t(u.clubs)}));return}setMyClubs(t);updateDoc(doc(db,'users',au.id),{clubIds:has?arrayRemove(id):arrayUnion(id)}).catch(e=>{console.warn(e);setMyClubs(c=>has?[...c,id]:c.filter(x=>x!==id))})};
 return <Ctx.Provider value={{real,logout,user,setUser,signIn,setSignIn,events,taken,toggleClub}}>{children}</Ctx.Provider>}
