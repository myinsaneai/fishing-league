import {useState} from 'react';
import {useAuth} from './auth';
const MSG={'auth/invalid-credential':'Wrong email or password.','auth/email-already-in-use':'That email already has an account.','auth/weak-password':'Use a password with at least 6 characters.','auth/popup-closed-by-user':'Sign-in was cancelled.','gis/popup_closed':'Sign-in was cancelled.','gis/access_denied':'Sign-in was cancelled.','gis/popup_failed_to_open':'The Google window was blocked. Allow pop-ups for this site and try again, or use email and password.','auth/invalid-email':'Enter a valid email.','auth/unauthorized-domain':'This domain is not authorised in Firebase Authentication.'};
// Google refuses to sign people in inside the built-in browser of other apps. 'blocked' = known for certain (the button is disabled),
// 'maybe' = looks like an embedded browser (a hint is shown, the button stays on).
export function embeddedBrowser(ua=''){
 if(/FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram/i.test(ua))return 'blocked';
 if(/Telegram|Viber|VKAndroidApp|vkclient|OKApp|Odnoklassniki|TikTok|musical_ly|Bytedance|Snapchat|Twitter|LinkedInApp|; wv\)|\bLine\//i.test(ua))return 'maybe';
 if(/iPhone|iPad|iPod/.test(ua)&&!/Safari\//.test(ua))return 'maybe';   // iPhone web views leave out the "Safari" part
 return '';
}
export default function SignIn({onClose}){
 const {google,signIn,signUp,reset}=useAuth();
 const [mode,setMode]=useState('in'),[f,setF]=useState({name:'',email:'',pw:''}),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const kind=embeddedBrowser(navigator.userAgent),inApp=kind==='blocked';
 const set=k=>e=>setF({...f,[k]:e.target.value});
 const run=async fn=>{setBusy(true);setMsg('');try{await fn();onClose?.()}catch(e){setMsg(MSG[e.code]||e.message)}setBusy(false)};
 const submit=async e=>{e.preventDefault();
  if(mode==='reset'){setBusy(true);try{await reset(f.email);setMsg('Check your inbox for the reset link.')}catch(x){setMsg(MSG[x.code]||x.message)}setBusy(false);return}
  run(()=>mode==='up'?signUp(f.name,f.email,f.pw):signIn(f.email,f.pw))};
 return <form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={submit}>
  <button type="button" className="x" aria-label="Close" onClick={onClose}>×</button>
  <h2>{mode==='up'?'Create account':mode==='reset'?'Reset password':'Sign in'}</h2>
  {mode!=='reset'&&<button type="button" className="o" disabled={busy||inApp} onClick={()=>run(google)}>G&nbsp; Continue with Google</button>}
  {mode!=='reset'&&inApp&&<p className="m">Google sign-in does not work inside Messenger or Facebook. Use email and password, or open this page in Safari or Chrome (menu → Open in browser).</p>}
  {mode!=='reset'&&kind==='maybe'&&<p className="m">This looks like the built-in browser of another app. If Google sign-in does not work here, open this page in Chrome or Safari (menu → Open in browser), or use email and password.</p>}
  {mode==='up'&&<input className="f" autoComplete="name" placeholder="Your name" aria-label="Your name" required value={f.name} onChange={set('name')}/>}
  <input className="f" type="email" autoComplete="email" placeholder="Email" aria-label="Email" required value={f.email} onChange={set('email')}/>
  {mode!=='reset'&&<input className="f" type="password" autoComplete={mode==='up'?'new-password':'current-password'} placeholder="Password" aria-label="Password" required minLength={6} value={f.pw} onChange={set('pw')}/>}
  <button className="p" disabled={busy}>{mode==='up'?'Create account':mode==='reset'?'Send reset link':'Sign in'}</button>
  {msg&&<p role="alert" className="m">{msg}</p>}
  <p className="m">{mode==='in'?<><a href="#" onClick={e=>{e.preventDefault();setMode('up')}}>Create account</a> · <a href="#" onClick={e=>{e.preventDefault();setMode('reset')}}>Forgot password?</a></>:<a href="#" onClick={e=>{e.preventDefault();setMode('in')}}>Back to sign in</a>}</p></form>}
