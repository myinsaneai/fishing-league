// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[2]||'new1'}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,cs}),
 setDoc:async(r,d)=>{calls.push(['setDoc',r.id,d])},updateDoc:async(r,d)=>{calls.push(['updateDoc',r.id,d])},
 getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  const src=q.name==='events'?(globalThis.__events||[]):(globalThis.__clubs||[]),c=q.cs?.[0];
  const list=!c?src:c.f==='status'?src.filter(e=>c.op==='in'?c.v.includes(e.status):e.status===c.v):c.f==='ownerId'?src.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async()=>{},getDownloadURL:async()=>'https://img.example/x.webp',deleteObject:async()=>{}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:name=>async data=>{calls.push([name,data]);const h=globalThis.__fn?.[name];return {data:h?await h(data):{}}}}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import App from '../src/App';
const ts=days=>({toDate:()=>new Date(Date.now()+days*864e5)});
const club=o=>({name:'Club',region:'Otago',town:'Dunedin',waterTypes:['Sea'],disciplines:[],coverUrl:'',ownerId:'o1',ownerName:'Olivia Organiser',createdAt:ts(-2),...o});

// Fixed creation times, so the list order (newest first) never depends on how fast the machine is.
const T0=Date.now(),fixed=h=>({toDate:()=>new Date(T0+h*3600e3)});
const event=o=>({description:'',waterType:'Sea',discipline:'Spin',format:'Individual',region:'Otago',district:'',waterbody:'Otago Harbour',limit:10,fee:0,coverUrl:'',ownerId:'o1',ownerName:'Olivia Organiser',startsAt:ts(30),createdAt:ts(-1),...o});
const fb=(role,uid)=>({uid,displayName:role+' '+uid,email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const users=[{uid:'a1',email:'a1@x.com',name:'Admin One',providers:['google.com'],role:'admin',disabled:false,verified:true},{uid:'ad2',email:'ad2@x.com',name:'Other Admin',providers:['password'],role:'admin',disabled:false,verified:true},{uid:'p1',email:'p1@x.com',name:'Pat Participant',providers:['google.com'],role:'participant',disabled:false,verified:true},{uid:'org',email:'org@x.com',name:'Olivia Organiser',providers:['password'],role:'organiser',disabled:false,verified:true}];
const counts={event:{registrations:12,evidence:5,files:7},club:{hostedEvents:2,members:3,files:1},user:{ownedEvents:0,ownedClubs:0,registrations:2,evidence:1,emails:4,avatar:true}};
beforeEach(()=>{calls.length=0;
 globalThis.__clubs=[club({id:'c1',name:'Test Club',status:'approved',createdAt:fixed(-1)}),club({id:'c2',name:'Another Club',status:'pending',createdAt:fixed(-2)})];
 globalThis.__events=[event({id:'e1',name:'Test Event One',status:'published',createdAt:fixed(-1)}),event({id:'e2',name:'Test Event Two',status:'draft',createdAt:fixed(-2)}),event({id:'e3',name:'Real Tournament',status:'published',createdAt:fixed(-3)})];
 globalThis.__fn={listUsers:()=>({users}),
  deleteEvent:d=>d.dryRun?{counts:counts.event}:{counts:counts.event},deleteClub:d=>({counts:counts.club}),
  deleteUser:d=>({counts:d.uid==='org'?{...counts.user,ownedEvents:1,ownedClubs:2}:counts.user})};
 // the real server wraps counts as {counts}; call() returns {data:<that>}
});
afterEach(cleanup);
const real=calls=>calls.filter(c=>/^delete/.test(c[0])&&!c[1]?.dryRun);
const openCleanup=async(role='admin')=>{mount('/admin');await signIn(fb(role,'a1'));await waitFor(()=>screen.getByRole('button',{name:'Clubs & events'}));fireEvent.click(screen.getByRole('button',{name:'Clubs & events'}))};
const typeDelete=()=>fireEvent.change(screen.getByLabelText('Type DELETE to confirm'),{target:{value:'DELETE'}});
describe('Admin → Clubs & events: delete for good',()=>{
 it('lists events and clubs with a Delete button each',async()=>{
  await openCleanup();expect(screen.getByText('Test Event One')).toBeTruthy();expect(screen.getByRole('button',{name:'Delete Real Tournament'})).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:/^Clubs/}));expect(screen.getByText('Test Club')).toBeTruthy();expect(screen.queryByText('Test Event One')).toBeNull();
 });
 it('shows what goes with an event before anything is deleted, and needs DELETE typed',async()=>{
  await openCleanup();fireEvent.click(screen.getByRole('button',{name:'Delete Test Event One'}));
  await waitFor(()=>screen.getByText(/12 registrations/));
  expect(screen.getByText(/5 evidence records/)).toBeTruthy();expect(screen.getByText(/7 stored files/)).toBeTruthy();expect(within(screen.getByRole('dialog')).getByText(/cannot be undone/)).toBeTruthy();
  expect(calls.filter(c=>/^delete/.test(c[0]))).toEqual([['deleteEvent',{eventId:'e1',dryRun:true}]]);   // only the preview so far
  const go=screen.getByRole('button',{name:'Delete permanently'});expect(go.disabled).toBe(true);
  const box=screen.getByLabelText('Type DELETE to confirm'),type=v=>fireEvent.change(box,{target:{value:v}});
  for(const v of ['delet','deleted','del ete','','x delete'])type(v),expect(go.disabled).toBe(true);   // the exact word is still needed
  for(const v of ['delete','DELETE','DeLeTe','DELETE   ','delete ','  Delete  '])type(v),expect(go.disabled).toBe(false);   // any capitals, spaces around it are ignored
  type('DELETE');
  await act(async()=>{fireEvent.click(go)});await waitFor(()=>screen.getByText('Deleted 1 event'));
  expect(real(calls)).toEqual([['deleteEvent',{eventId:'e1'}]]);
 });
 it('Cancel and the close button delete nothing',async()=>{
  await openCleanup();fireEvent.click(screen.getByRole('button',{name:'Delete Test Event One'}));await waitFor(()=>screen.getByText(/12 registrations/));
  typeDelete();fireEvent.click(screen.getByText('Cancel'));expect(screen.queryByRole('button',{name:'Delete permanently'})).toBeNull();expect(real(calls)).toEqual([]);
 });
 it('deletes several at once: search, select all shown, one confirmation, one call each',async()=>{
  await openCleanup();fireEvent.change(screen.getByLabelText('Search events'),{target:{value:'test event'}});
  expect(screen.queryByText('Real Tournament')).toBeNull();
  fireEvent.click(screen.getByLabelText('Select all shown'));expect(screen.getByRole('button',{name:'Delete selected (2)'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Delete selected (2)'}));
  await waitFor(()=>screen.getByText(/24 registrations/));   // two events' preview added together
  expect(screen.getByText('Delete 2 events permanently?')).toBeTruthy();
  typeDelete();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}))});await waitFor(()=>screen.getByText('Deleted 2 events'));
  expect(real(calls).map(c=>c[1].eventId)).toEqual(['e1','e2']);
 });
 it('reports the ones that failed and still deletes the rest',async()=>{
  globalThis.__fn.deleteEvent=d=>{if(d.eventId==='e2'&&!d.dryRun)throw new Error('Something broke.');return {counts:counts.event}};
  await openCleanup();fireEvent.change(screen.getByLabelText('Search events'),{target:{value:'test event'}});fireEvent.click(screen.getByLabelText('Select all shown'));fireEvent.click(screen.getByRole('button',{name:'Delete selected (2)'}));
  await waitFor(()=>screen.getByText(/24 registrations/));typeDelete();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}))});
  await waitFor(()=>screen.getByText('Deleted 1 event'));expect(screen.getByRole('alert').textContent).toMatch(/Test Event Two: Something broke\./);
 });
 it('lists what cannot be deleted, and offers no delete button when nothing can',async()=>{
  globalThis.__fn.deleteEvent=()=>{throw new Error('That event does not exist.')};
  await openCleanup();fireEvent.click(screen.getByRole('button',{name:'Delete Test Event One'}));
  await waitFor(()=>screen.getByText(/These cannot be deleted/));expect(screen.getByText(/Test Event One: That event does not exist\./)).toBeTruthy();
  expect(screen.queryByLabelText('Type DELETE to confirm')).toBeNull();expect(screen.getByRole('button',{name:'Delete permanently'}).disabled).toBe(true);
 });
 it('clubs: says hosted events stay and followers stop following',async()=>{
  await openCleanup();fireEvent.click(screen.getByRole('tab',{name:/^Clubs/}));fireEvent.click(screen.getByRole('button',{name:'Delete Test Club'}));
  await waitFor(()=>screen.getByText(/2 events hosted by it will stay, without the club/));expect(screen.getByText(/3 people will stop following it/)).toBeTruthy();
  typeDelete();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}))});await waitFor(()=>screen.getByText('Deleted 1 club'));
  expect(real(calls)).toEqual([['deleteClub',{clubId:'c1'}]]);
 });
});
describe('Admin → Users: delete',()=>{
 const openUsers=async(role='admin')=>{mount('/admin');await signIn(fb(role,'a1'));await waitFor(()=>screen.getByText('Pat Participant'))};
 it('an admin can delete participants and organisers, but not themselves or other admins',async()=>{
  await openUsers();expect(screen.getByRole('button',{name:'Delete Pat Participant'})).toBeTruthy();expect(screen.getByRole('button',{name:'Delete Olivia Organiser'})).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Delete Other Admin'})).toBeNull();expect(screen.queryByRole('button',{name:'Delete Admin One'})).toBeNull();
  expect(screen.queryByLabelText('Select Other Admin')).toBeNull();expect(screen.queryByLabelText('Select Admin One')).toBeNull();
 });
 it('a superadmin can also delete other admins',async()=>{
  await openUsers('superadmin');expect(screen.getByRole('button',{name:'Delete Other Admin'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Delete Admin One'})).toBeNull();   // never themselves
 });
 it('shows what goes with a user, deletes them, and removes them from the list',async()=>{
  await openUsers();fireEvent.click(screen.getByRole('button',{name:'Delete Pat Participant'}));
  await waitFor(()=>screen.getByText(/2 registrations in other events/));expect(screen.getByText(/1 evidence record and their photos/)).toBeTruthy();expect(screen.getByText(/4 emails sent to them/)).toBeTruthy();expect(screen.getByText(/1 profile picture/)).toBeTruthy();
  expect(calls.filter(c=>c[0]==='deleteUser')).toEqual([['deleteUser',{uid:'p1',dryRun:true}]]);
  typeDelete();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Delete permanently'}))});await waitFor(()=>screen.getByText('Deleted 1 user'));
  expect(real(calls.filter(c=>c[0]==='deleteUser'))).toEqual([['deleteUser',{uid:'p1',deleteOwned:false}]]);
  fireEvent.click(screen.getByText('Close'));expect(screen.queryByText('Pat Participant')).toBeNull();expect(screen.getByText('Olivia Organiser')).toBeTruthy();
 });
 it('a user who owns events or clubs needs the extra tick before anything is deleted',async()=>{
  await openUsers();fireEvent.click(screen.getByRole('button',{name:'Delete Olivia Organiser'}));
  await waitFor(()=>screen.getByText(/1 event they own, with everything in them/));expect(screen.getByText(/2 clubs they own/)).toBeTruthy();
  typeDelete();const go=screen.getByRole('button',{name:'Delete permanently'});expect(go.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText(/Also delete the 1 event and 2 clubs owned by this user/));expect(go.disabled).toBe(false);
  await act(async()=>{fireEvent.click(go)});await waitFor(()=>screen.getByText('Deleted 1 user'));
  expect(real(calls.filter(c=>c[0]==='deleteUser'))).toEqual([['deleteUser',{uid:'org',deleteOwned:true}]]);
 });
 it('selects several users and deletes them in one go',async()=>{
  await openUsers();fireEvent.click(screen.getByLabelText('Select all shown users'));expect(screen.getByRole('button',{name:'Delete selected (2)'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Delete selected (2)'}));await waitFor(()=>screen.getByText('Delete 2 users permanently?'));
  expect(screen.getByText('Pat Participant (p1@x.com)')).toBeTruthy();
 });
});
