import {createContext,useContext,useEffect,useState} from 'react';
import {onAuthStateChanged,signInWithPopup,GoogleAuthProvider,signInWithEmailAndPassword,createUserWithEmailAndPassword,updateProfile,sendEmailVerification,sendPasswordResetEmail,signOut} from 'firebase/auth';
import {doc,getDoc,setDoc,serverTimestamp} from 'firebase/firestore';
import {auth,db} from './firebase';
const Ctx=createContext();
export const useAuth=()=>useContext(Ctx);
const ensureDoc=async(u,force)=>{try{const r=doc(db,'users',u.uid);if(force||!(await getDoc(r)).exists())await setDoc(r,{displayName:u.displayName||'',email:u.email||'',photoURL:u.photoURL||'',createdAt:serverTimestamp()})}catch(e){console.warn('user doc',e)}};
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[ready,setReady]=useState(false);
 const load=async(u,force=false)=>{if(!u){setUser(null);return}const t=await u.getIdTokenResult(force);let clubIds=[];try{clubIds=(await getDoc(doc(db,'users',u.uid))).data()?.clubIds||[]}catch{}
  setUser({id:u.uid,clubIds,photo:u.photoURL||'',name:u.displayName||u.email,email:u.email,verified:u.emailVerified,role:t.claims.role||'participant'})};
 useEffect(()=>onAuthStateChanged(auth,async u=>{await load(u);setReady(true);if(u)ensureDoc(u)}),[]);
 const api={user,ready,
  google:()=>signInWithPopup(auth,new GoogleAuthProvider()),
  signIn:(e,p)=>signInWithEmailAndPassword(auth,e,p),
  signUp:async(n,e,p)=>{const c=await createUserWithEmailAndPassword(auth,e,p);await updateProfile(c.user,{displayName:n});await sendEmailVerification(c.user);await ensureDoc(auth.currentUser,true);await load(auth.currentUser)},
  reset:e=>sendPasswordResetEmail(auth,e),
  out:()=>signOut(auth),
  refresh:()=>load(auth.currentUser,true)};
 return <Ctx.Provider value={api}>{children}</Ctx.Provider>}
