import {Routes,Route,NavLink,Link,Navigate,useLocation} from 'react-router-dom';
import {useApp} from './store';
import {useAuth} from './auth';
import {USERS} from './data';
import SignIn from './SignIn';
import Modal from './Modal';
import ErrorBoundary from './ErrorBoundary';
import {Catalog,EventPage,MyPage,Manage,Admin} from './pages';
import {Clubs,ClubPage,ClubEditor} from './clubs';
import {EventEditor} from './events';
import {useClubs} from './clubsStore';
import {useEvents} from './eventsStore';
import {PendingBadge,pendingCount} from './approvals';
import {useRoleRequests} from './organiserRequests';
const STAFF=['organiser','admin','superadmin'],ADMINS=['admin','superadmin'];
// Sends signed-out (or under-privileged) visitors to the start page. Waits for Firebase to report the session first.
function Guard({roles,children}){
 const {user}=useApp(),{ready}=useAuth();
 if(!ready)return <p className="m">Loading…</p>;
 return user&&(!roles||roles.includes(user.role))?children:<Navigate to="/" replace/>;
}
export default function App(){
 const {user,setUser,setSignIn,signIn,real,logout}=useApp();
 const {pathname}=useLocation(),{clubs}=useClubs(),{events}=useEvents();
 const isAdmin=ADMINS.includes(user?.role),requests=useRoleRequests(isAdmin);
 const waiting=isAdmin?pendingCount(clubs,events,requests):0;   // clubs, events and organiser requests waiting for an admin, shown on the Admin link
 return <>
  <header className="hdr"><Link className="brand" to="/"><b className="logo">Fishing League</b></Link>
   <nav className="nav" aria-label="Main"><NavLink to="/" end>Events</NavLink><NavLink to="/clubs">Clubs</NavLink>{user&&<NavLink to="/me">My page</NavLink>}{user&&STAFF.includes(user.role)&&<NavLink to="/manage">Manage</NavLink>}{ADMINS.includes(user?.role)&&<NavLink to="/admin"><span className="nl">Admin<PendingBadge n={waiting}/></span></NavLink>}</nav>
   <div className="hr">{!real&&<select className="f" aria-label="Demo role" value={user?.role||'guest'} onChange={e=>setUser(USERS[e.target.value]||null)}><option value="guest">Demo: Guest</option><option value="participant">Demo: Participant</option><option value="organiser">Demo: Organiser</option><option value="admin">Demo: Admin</option></select>}
    {user?<><span className="t">{user.name}{user.role!=='participant'&&' · '+user.role}</span><button className="o" onClick={logout}>Sign out</button></>:<button className="p" onClick={()=>setSignIn(true)}>Sign in</button>}</div></header>
  <main className="wrap"><ErrorBoundary key={pathname}><Routes>
    <Route path="/" element={<Catalog/>}/>
    <Route path="/event/new" element={<Guard roles={STAFF}><EventEditor/></Guard>}/>
    <Route path="/event/:id" element={<EventPage/>}/>
    <Route path="/event/:id/edit" element={<Guard roles={STAFF}><EventEditor/></Guard>}/>
    <Route path="/clubs" element={<Clubs/>}/>
    <Route path="/clubs/new" element={<Guard roles={STAFF}><ClubEditor/></Guard>}/>
    <Route path="/clubs/:id" element={<ClubPage/>}/>
    <Route path="/clubs/:id/edit" element={<Guard roles={STAFF}><ClubEditor/></Guard>}/>
    <Route path="/me" element={<Guard><MyPage/></Guard>}/>
    <Route path="/manage" element={<Guard roles={STAFF}><Manage/></Guard>}/>
    <Route path="/admin" element={<Guard roles={ADMINS}><Admin/></Guard>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></ErrorBoundary></main>
  <footer className="ftr"><div><b>Fishing League</b><p>Fishing competitions across New Zealand.</p></div><span>© Fishing League</span></footer>
  {signIn&&<Modal onClose={()=>setSignIn(false)}><SignIn onClose={()=>setSignIn(false)}/></Modal>}
 </>}
