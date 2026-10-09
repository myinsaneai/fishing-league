import {useEffect,useState} from 'react';
import {Routes,Route,NavLink,Link,useLocation} from 'react-router-dom';
import {useApp} from './store';
import {USERS} from './data';
import {Catalog,EventPage,MyPage,Manage,Clubs,Admin} from './pages';
export default function App(){
 const {user,setUser,signIn,setSignIn}=useApp();
 const [open,setOpen]=useState(false);const {pathname}=useLocation();
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{const k=e=>e.key==='Escape'&&setOpen(false);window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[]);
 const login=()=>{setUser(USERS.participant);setSignIn(false)};
 return <>
  <header className={'hdr'+(open?' open':'')}><Link className="brand" to="/"><b style={{fontSize:20}}>Fishing League</b></Link>
   <div className="menu" id="site-menu"><nav className="nav" aria-label="Main"><NavLink to="/" end>Events</NavLink><NavLink to="/clubs">Clubs</NavLink>{user&&<NavLink to="/me">My page</NavLink>}{user&&user.role!=='participant'&&<NavLink to="/manage">Manage</NavLink>}{user?.role==='admin'&&<NavLink to="/admin">Admin</NavLink>}</nav>
   <select className="f" aria-label="Demo role" value={user?.role||'guest'} onChange={e=>setUser(USERS[e.target.value]||null)}><option value="guest">Demo: Guest</option><option value="participant">Demo: Participant</option><option value="organiser">Demo: Organiser</option><option value="admin">Demo: Admin</option></select></div>
   {user?<span className="t">{user.name}</span>:<button className="p" onClick={()=>setSignIn(true)}>Sign in</button>}
   <button className="burger" aria-label={open?'Close menu':'Open menu'} aria-expanded={open} aria-controls="site-menu" onClick={()=>setOpen(!open)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{open?<path d="M6 6l12 12M18 6L6 18"/>:<path d="M4 7h16M4 12h16M4 17h16"/>}</svg></button>
   {open&&<div className="scrim" onClick={()=>setOpen(false)}/>}</header>
  <main className="wrap"><Routes><Route path="/" element={<Catalog/>}/><Route path="/event/:id" element={<EventPage/>}/><Route path="/clubs" element={<Clubs/>}/><Route path="/me" element={<MyPage/>}/><Route path="/manage" element={<Manage/>}/><Route path="/admin" element={<Admin/>}/></Routes></main>
  <footer className="ftr"><div><b>Fishing League</b><p>Fishing competitions across New Zealand.</p></div><span>© Fishing League</span></footer>
  {signIn&&<div className="modal" onClick={()=>setSignIn(false)}><form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();login()}}><h2>Sign in</h2>
   <button type="button" className="o" onClick={login}>G&nbsp; Continue with Google</button><input className="f" type="email" placeholder="Email" aria-label="Email"/><input className="f" type="password" placeholder="Password" aria-label="Password"/><button className="p">Sign in</button><p className="m">Prototype: any sign-in logs you in as a participant.</p></form></div>}
 </>}
