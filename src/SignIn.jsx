import {useState} from 'react';
import {useAuth} from './auth';
const MSG={'auth/invalid-credential':'Wrong email or password.','auth/email-already-in-use':'That email already has an account.','auth/weak-password':'Use a password with at least 6 characters.','auth/popup-closed-by-user':'Sign-in was cancelled.','auth/invalid-email':'Enter a valid email.','auth/unauthorized-domain':'This domain is not authorised in Firebase Authentication.'};
export default function SignIn({onClose}){
 const {google,signIn,signUp,reset}=useAuth();
 const [mode,setMode]=useState('in'),[f,setF]=useState({name:'',email:'',pw:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const set=k=>e=>setF({...f,[k]:e.target.value});
 const run=async fn=>{setBusy(true);setMsg('');try{await fn();onClose?.()}catch(e){setMsg(MSG[e.code]||e.message)}setBusy(false)};
 const submit=async e=>{e.preventDefault();
  if(mode==='reset'){setBusy(true);try{await reset(f.email);setMsg('Check your inbox for the reset link.')}catch(x){setMsg(MSG[x.code]||x.message)}setBusy(false);return}
  run(()=>mode==='up'?signUp(f.name,f.email,f.pw):signIn(f.email,f.pw))};
 return <form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={submit}>
  <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
  <h2>{mode==='up'?'Create account':mode==='reset'?'Reset password':'Sign in'}</h2>
  {mode!=='reset'&&<button type="button" className="o" disabled={busy} onClick={()=>run(google)}>G&nbsp; Continue with Google</button>}
  {mode==='up'&&<input className="f" placeholder="Your name" aria-label="Your name" required value={f.name} onChange={set('name')}/>}
  <input className="f" type="email" placeholder="Email" aria-label="Email" required value={f.email} onChange={set('email')}/>
  {mode!=='reset'&&<input className="f" type="password" placeholder="Password" aria-label="Password" required minLength={6} value={f.pw} onChange={set('pw')}/>}
  <button className="p" disabled={busy}>{mode==='up'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button>
  {msg&&<p role="alert" className="m">{msg}</p>}
  <p className="m">{mode==='in'?<><a href="#" onClick={e=>{e.preventDefault();setMode('up')}}>Create account</a> · <a href="#" onClick={e=>{e.preventDefault();setMode('reset')}}>Forgot password?</a></>:<a href="#" onClick={e=>{e.preventDefault();setMode('in')}}>Back to sign in</a>}</p></form>}
