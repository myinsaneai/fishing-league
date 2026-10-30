// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(db,...p)=>({kind:'doc',coll:p[0],id:p[1]||'new1',path:p.join('/')}),collection:(db,...p)=>({kind:'col',name:p[0],path:p.join('/')}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({...c,cs}),
 setDoc:async()=>{},updateDoc:async()=>{},getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  if(q.kind==='doc'&&q.coll==='roleRequests'){
   const push=()=>{const r=globalThis.__reqs?.[q.id];ok({exists:()=>!!r,id:q.id,data:()=>r})};
   (globalThis.__docCb??={})[q.id]=push;push();return()=>{}}
  if(q.kind==='col'&&q.name==='roleRequests'){
   const push=()=>ok({docs:Object.entries(globalThis.__reqs||{}).map(([id,d])=>({id,data:()=>d}))});
   globalThis.__colCb=push;push();return()=>{}}
  const src=q.name==='events'&&q.path==='events'?(globalThis.__events||[]):q.name==='clubs'?(globalThis.__clubs||[]):[];
  ok({docs:src.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async()=>{},getDownloadURL:async()=>'https://img.example/x.webp',deleteObject:async()=>{}}));
vi.mock('../src/firebase',()=>({auth:{get currentUser(){return globalThis.__authUser}},db:{},storage:{},call:name=>async data=>{calls.push([name,data]);const h=globalThis.__fn?.[name];return {data:h?await h(data):{}}}}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {RegistrationsProvider} from '../src/registrations';
import App from '../src/App';
const ts=days=>({toDate:()=>new Date(Date.now()+days*864e5)});
const fixed=(()=>{const T=Date.now();return d=>({toDate:()=>new Date(T+d*864e5)})})();
const club=o=>({name:'Club',region:'Otago',town:'Dunedin',waterTypes:['Sea'],disciplines:[],coverUrl:'',ownerId:'o1',ownerName:'Olivia Organiser',createdAt:ts(-2),...o});
const fb=(uid,name='Pat Participant')=>({uid,displayName:name,email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role:globalThis.__role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><RegistrationsProvider><AppProvider><App/></AppProvider></RegistrationsProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{globalThis.__authUser=u;await act(async()=>{await globalThis.__cb(u)})};
const REASON='I run the Taupō fly-fishing club and want to organise our monthly competitions.';
const req=(uid,o={})=>({uid,name:'Pat '+uid,email:uid+'@x.com',reason:REASON,status:'pending',createdAt:fixed(-1),decidedBy:null,decidedByName:'',decidedAt:null,note:'',...o});
const emit=async()=>{await act(async()=>{Object.values(globalThis.__docCb||{}).forEach(f=>f());globalThis.__colCb?.()})};
beforeEach(()=>{calls.length=0;globalThis.__role='participant';globalThis.__reqs={};globalThis.__docCb={};globalThis.__colCb=null;globalThis.__events=[];globalThis.__clubs=[];globalThis.__fn={}});
afterEach(cleanup);
const myPage=async(role='participant',uid='p1')=>{globalThis.__role=role;mount('/me');await signIn(fb(uid));await waitFor(()=>screen.getByText('Upcoming'))};
const typeReason=v=>fireEvent.change(screen.getByLabelText('Why would you like to be an organiser?'),{target:{value:v}});
describe('My page: asking to become an organiser',()=>{
 it('offers the request to a participant, and Send stays off until the reason is long enough',async()=>{
  await myPage();expect(screen.getByText('Become an organiser')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Request organiser access'}));
  const send=screen.getByRole('button',{name:'Send request'});expect(send.disabled).toBe(true);
  typeReason('too short');expect(send.disabled).toBe(true);expect(screen.getByText(/At least 20 characters \(9 so far\)/)).toBeTruthy();
  typeReason(REASON);expect(send.disabled).toBe(false);
 });
 it('sends the reason, then shows the request as waiting for an admin',async()=>{
  globalThis.__fn.requestOrganiserRole=({reason})=>{globalThis.__reqs.p1=req('p1',{reason});return {status:'pending',created:true}};
  await myPage();fireEvent.click(screen.getByRole('button',{name:'Request organiser access'}));typeReason('  '+REASON+'  ');
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Send request'}))});await emit();
  expect(calls.filter(c=>c[0]==='requestOrganiserRole')).toEqual([['requestOrganiserRole',{reason:'  '+REASON+'  '}]]);
  await waitFor(()=>screen.getByText(/Your request is waiting for an admin/));expect(screen.getByText(REASON)).toBeTruthy();expect(screen.queryByRole('button',{name:'Send request'})).toBeNull();
 });
 it('shows the server\'s message when sending fails, and keeps the text',async()=>{
  globalThis.__fn.requestOrganiserRole=()=>{throw new Error('Please explain in a few sentences.')};
  await myPage();fireEvent.click(screen.getByRole('button',{name:'Request organiser access'}));typeReason(REASON);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Send request'}))});
  await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/Please explain/);expect(screen.getByLabelText('Why would you like to be an organiser?').value).toBe(REASON);
 });
 it('while waiting, the person can edit the reason',async()=>{
  globalThis.__reqs.p1=req('p1');globalThis.__fn.requestOrganiserRole=({reason})=>{globalThis.__reqs.p1=req('p1',{reason});return {status:'pending',created:false}};
  await myPage();await waitFor(()=>screen.getByText(/waiting for an admin/));fireEvent.click(screen.getByRole('button',{name:'Edit request'}));
  expect(screen.getByLabelText('Why would you like to be an organiser?').value).toBe(REASON);
  const more=REASON+' We also help with the Wellington league.';typeReason(more);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Save changes'}))});await emit();
  expect(calls.at(-1)).toEqual(['requestOrganiserRole',{reason:more}]);await waitFor(()=>screen.getByText(more));
 });
 it('after a decline it shows the reason and lets the person ask again',async()=>{
  globalThis.__reqs.p1=req('p1',{status:'declined',note:'Please join a club first.'});
  await myPage();await waitFor(()=>screen.getByText(/Your last request was declined/));expect(screen.getByText(/Reason: Please join a club first\./)).toBeTruthy();
  expect(screen.getByRole('button',{name:'Request organiser access'})).toBeTruthy();
 });
 it('after approval the new role is picked up without signing in again, and the card goes',async()=>{
  globalThis.__reqs.p1=req('p1');await myPage();await waitFor(()=>screen.getByText(/waiting for an admin/));
  expect(screen.queryByRole('link',{name:'Manage'})).toBeNull();
  globalThis.__role='organiser';globalThis.__reqs.p1=req('p1',{status:'approved',decidedByName:'Ada'});await emit();   // the admin approved
  await waitFor(()=>expect(screen.queryByText('Become an organiser')).toBeNull());expect(screen.getByRole('link',{name:'Manage'})).toBeTruthy();
 });
 it('organisers and admins do not see the card',async()=>{
  for(const role of ['organiser','admin']){await myPage(role,'x1');expect(screen.queryByText('Become an organiser')).toBeNull();cleanup()}
 });
});
describe('Admin → Approvals → Organisers',()=>{
 const openOrganisers=async()=>{globalThis.__role='admin';mount('/admin');await signIn(fb('a1','Ada Admin'));await waitFor(()=>screen.getByRole('button',{name:/^Approvals/}));fireEvent.click(screen.getByRole('button',{name:/^Approvals/}));fireEvent.click(screen.getByRole('tab',{name:/^Organisers/}))};
 const seed=()=>{globalThis.__reqs={p1:req('p1',{createdAt:fixed(-1)}),p2:req('p2',{name:'Sam Second',reason:'I would like to run beginner events at Lake Wanaka.',createdAt:fixed(-2)}),p3:req('p3',{status:'declined',decidedByName:'Ada Admin',decidedAt:fixed(-1),note:'Not yet.'}),p4:req('p4',{status:'approved',decidedByName:'Ada Admin',decidedAt:fixed(-1)})}};
 it('shows the waiting requests with their reasons, newest first, and a small red number on the tab',async()=>{
  seed();await openOrganisers();
  await waitFor(()=>screen.getByRole('tab',{name:'Organisers 2 pending'}));
  expect(screen.getByRole('tab',{name:'Organisers 2 pending'}).querySelector('.nl > .bdg').textContent).toBe('2');
  const rows=[...document.querySelectorAll('.li')];expect(rows.map(r=>r.querySelector('b').textContent)).toEqual(['Pat p1','Sam Second']);
  expect(screen.getByText(REASON)).toBeTruthy();expect(screen.getByText('I would like to run beginner events at Lake Wanaka.')).toBeTruthy();expect(screen.queryByText('Pat p3')).toBeNull();
 });
 it('approves with one click',async()=>{
  seed();globalThis.__fn.decideOrganiserRequest=()=>({status:'approved'});await openOrganisers();
  await waitFor(()=>screen.getByText('Sam Second'));
  await act(async()=>{fireEvent.click(within(screen.getByText('Sam Second').closest('.li')).getByRole('button',{name:'Approve'}))});
  expect(calls.filter(c=>c[0]==='decideOrganiserRequest')).toEqual([['decideOrganiserRequest',{uid:'p2',decision:'approve',note:''}]]);
 });
 it('declining needs a reason, which is sent to the person',async()=>{
  seed();globalThis.__fn.decideOrganiserRequest=()=>({status:'declined'});await openOrganisers();await waitFor(()=>screen.getByText('Sam Second'));
  const row=within(screen.getByText('Sam Second').closest('.li'));fireEvent.click(row.getByRole('button',{name:'Decline…'}));
  fireEvent.click(row.getByRole('button',{name:'Confirm decline'}));expect(screen.getByRole('alert').textContent).toMatch(/short reason/);expect(calls.some(c=>c[0]==='decideOrganiserRequest')).toBe(false);
  fireEvent.change(row.getByLabelText('Reason for declining Sam Second'),{target:{value:'Please join a club first.'}});
  await act(async()=>{fireEvent.click(row.getByRole('button',{name:'Confirm decline'}))});
  expect(calls.filter(c=>c[0]==='decideOrganiserRequest')).toEqual([['decideOrganiserRequest',{uid:'p2',decision:'decline',note:'Please join a club first.'}]]);
 });
 it('shows the server\'s message when a request was already decided',async()=>{
  seed();globalThis.__fn.decideOrganiserRequest=()=>{throw new Error('This request was already decided.')};await openOrganisers();await waitFor(()=>screen.getByText('Sam Second'));
  await act(async()=>{fireEvent.click(within(screen.getByText('Sam Second').closest('.li')).getByRole('button',{name:'Approve'}))});
  await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/already decided/);
 });
 it('filters: Declined and Approved show who decided and why; All shows everything; nothing waiting says so',async()=>{
  seed();await openOrganisers();await waitFor(()=>screen.getByText('Sam Second'));
  fireEvent.click(screen.getByRole('button',{name:'Declined'}));expect(screen.getByText('Pat p3')).toBeTruthy();expect(screen.getByText(/Declined by Ada Admin on .*: Not yet\./)).toBeTruthy();expect(screen.queryByText('Pat p1')).toBeNull();expect(screen.queryByRole('button',{name:'Approve'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Approved'}));expect(screen.getByText('Pat p4')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'All'}));expect(document.querySelectorAll('.li').length).toBe(4);
  cleanup();globalThis.__reqs={};await openOrganisers();await waitFor(()=>screen.getByText('No organiser requests are waiting.'));expect(screen.getByRole('tab',{name:'Organisers none pending'})).toBeTruthy();
 });
 it('keeps the chosen filter when switching tabs, mapping Rejected and Declined',async()=>{
  seed();globalThis.__clubs=[club({id:'c1',name:'Old Club',status:'rejected'})];await openOrganisers();await waitFor(()=>screen.getByText('Sam Second'));
  fireEvent.click(screen.getByRole('button',{name:'Declined'}));fireEvent.click(screen.getByRole('tab',{name:/^Clubs/}));
  await waitFor(()=>screen.getByText('Old Club'));expect(screen.getByRole('button',{name:'Rejected'}).getAttribute('aria-pressed')).toBe('true');
 });
 it('the Admin menu link and the Approvals tab count requests together with clubs and events',async()=>{
  seed();globalThis.__clubs=[club({id:'c1',name:'Waiting Club',status:'pending'})];globalThis.__role='admin';mount('/admin');await signIn(fb('a1','Ada Admin'));
  await waitFor(()=>screen.getByRole('link',{name:'Admin 3 pending'}));expect(screen.getByRole('button',{name:'Approvals 3 pending'})).toBeTruthy();
 });
 it('only admins listen to the requests: an organiser sees no number',async()=>{
  seed();globalThis.__role='organiser';mount('/');await signIn(fb('o1','Olivia'));await waitFor(()=>screen.getByRole('link',{name:'Manage'}));expect(document.querySelector('.nav .bdg')).toBeNull();
 });
});
