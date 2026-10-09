import {Routes,Route,NavLink,Link} from 'react-router-dom';
import {useApp} from './store';
import {USERS} from './data';
import {Catalog,EventPage,MyPage,Manage,Clubs,Admin} from './pages';
export default function App(){
 const {user,setUser,signIn,setSignIn}=useApp();
 const login=()=>{setUser(USERS.participant);setSignIn(false)};
 return <>
  <header className="hdr"><Link to="/"><b style={{fontSize:20}}>Fishing League</b></Link>
   <nav className="nav"><NavLink to="/" end>Events</NavLink><NavLink to="/clubs">Clubs</NavLink>{user&&<NavLink to="/me">My page</NavLink>}{user&&user.role!=='participant'&&<NavLink to="/manage">Manage</NavLink>}{user?.role==='admin'&&<NavLink to="/admin">Admin</NavLink>}</nav>
   <select className="f" aria-label="Demo role" value={user?.role||'guest'} onChange={e=>setUser(USERS[e.target.value]||null)}><option value="guest">Demo: Guest</option><option value="participant">Demo: Participant</option><option value="organiser">Demo: Organiser</option><option value="admin">Demo: Admin</option></select>
   {user?<span className="t">{user.name}</span>:<button className="p" onClick={()=>setSignIn(true)}>Sign in</button>}</header>
  <main className="wrap"><Routes><Route path="/" element={<Catalog/>}/><Route path="/event/:id" element={<EventPage/>}/><Route path="/clubs" element={<Clubs/>}/><Route path="/me" element={<MyPage/>}/><Route path="/manage" element={<Manage/>}/><Route path="/admin" element={<Admin/>}/></Routes></main>
  <footer className="ftr"><div><b>Fishing League</b><p>Fishing competitions across New Zealand.</p></div><span>© Fishing League</span></footer>
  {signIn&&<div className="modal" onClick={()=>setSignIn(false)}><form className="sheet" onClick={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();login()}}><h2>Sign in</h2>
   <button type="button" className="o" onClick={login}>G&nbsp; Continue with Google</button><input className="f" type="email" placeholder="Email" aria-label="Email"/><input className="f" type="password" placeholder="Password" aria-label="Password"/><button className="p">Sign in</button><p className="m">Prototype: any sign-in logs you in as a participant.</p></form></div>}
 </>}
