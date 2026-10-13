// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1]||'new1',path:a.slice(1).join('/')}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,cs}),
 setDoc:async(r,d)=>{calls.push(['setDoc',r.id,d])},updateDoc:async(r,d)=>{calls.push(['updateDoc',r.id,d])},getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  if(q.path==='settings/placeholders'){ok({data:()=>({})});return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):[],c=q.cs?.[0];
  const list=!c?src:c.f==='status'?src.filter(e=>c.op==='in'?c.v.includes(e.status):e.status===c.v):c.f==='ownerId'?src.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:vi.fn(),uploadBytes:vi.fn(),getDownloadURL:vi.fn(),deleteObject:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import App from '../src/App';
import {nzToDate} from '../src/time';
import {validateEvent} from '../src/events';
const ts=d=>({toDate:()=>d instanceof Date?d:new Date(Date.now()+d*3600e3)});
const ev=o=>({id:'e1',name:'Taupō Cup',description:'',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',district:'',waterbody:'Lake Taupō',limit:10,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(48),endsAt:ts(52),...o});
const fb=(role,uid)=>({uid,displayName:'Pat',email:'p@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const app=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const fill=(l,v)=>fireEvent.change(screen.getByLabelText(l),{target:{value:v}});
const form=async()=>{app('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/))};
const basics=()=>{fill(/Event name/,'Dawn Cup');fireEvent.click(screen.getByLabelText(/Freshwater fishing/));fill(/^Discipline/,'Fly');fill(/^Region/,'Waikato');fill(/Waterbody/,'Lake Taupō')};
const submit=()=>fireEvent.click(screen.getByRole('button',{name:/Submit for approval|Save event/}));
beforeEach(()=>{calls.length=0;globalThis.__events=[ev({})]});
afterEach(cleanup);
describe('event form: end date and time',()=>{
 it('has End date and End time next to the start',async()=>{
  await form();expect(screen.getByLabelText(/End date/).type).toBe('date');expect([...screen.getByLabelText(/^End time/).querySelectorAll('option')].map(o=>o.textContent)).toContain('3:15 pm');
 });
 it('fills the end in, four hours after the start, until the organiser sets it',async()=>{
  await form();fill(/Start date/,'2999-03-10');
  expect(screen.getByLabelText(/End date/).value).toBe('2999-03-10');expect(screen.getByLabelText(/^End time/).value).toBe('11:00');
  fill(/^Start time/,'14:00');expect(screen.getByLabelText(/^End time/).value).toBe('18:00');
  fill(/^Start time/,'22:00');expect(screen.getByLabelText(/End date/).value).toBe('2999-03-11');expect(screen.getByLabelText(/^End time/).value).toBe('02:00');
  fill(/End date/,'2999-03-12');fill(/^End time/,'16:00');
  fill(/^Start time/,'08:00');expect(screen.getByLabelText(/End date/).value).toBe('2999-03-12');expect(screen.getByLabelText(/^End time/).value).toBe('16:00');
 });
 it('refuses an end that is not after the start, and saves a good one',async()=>{
  await form();basics();fill(/Start date/,'2999-03-10');fill(/^Start time/,'10:00');
  fill(/End time/,'09:00');submit();await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/end must be after the start/);expect(calls.length).toBe(0);
  fill(/End date/,'2999-03-12');fill(/^End time/,'16:30');submit();await waitFor(()=>expect(calls.length).toBeGreaterThan(0));
  expect(calls[0][2].startsAt.toISOString()).toBe(nzToDate('2999-03-10','10:00').toISOString());expect(calls[0][2].endsAt.toISOString()).toBe(nzToDate('2999-03-12','16:30').toISOString());
 });
 it('needs an end for events that were saved without one',async()=>{
  globalThis.__events=[ev({endsAt:undefined})];app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/End date/));
  expect(screen.getByLabelText(/End date/).value).toBe('');submit();await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/Choose the end/);expect(calls.length).toBe(0);
  fill(/End date/,'2999-01-01');fill(/^End time/,'12:00');submit();await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].endsAt).toBeInstanceOf(Date);
 });
 it('shows the saved end when editing',async()=>{
  globalThis.__events=[ev({startsAt:ts(new Date('2026-10-11T20:00:00Z')),endsAt:ts(new Date('2026-10-14T02:30:00Z'))})];   // 9:00 am 12 Oct to 3:30 pm 14 Oct, NZ
  app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/End date/));
  expect(screen.getByLabelText(/End date/).value).toBe('2026-10-14');expect(screen.getByLabelText(/^End time/).value).toBe('15:30');
 });
 it('validation: end is required and must be later',()=>{
  const f={name:'Spring Cup',description:'',waterType:'Sea',discipline:'Spin',disciplineOther:'',format:'Individual',region:'Otago',district:'',waterbody:'Harbour',meetingPoint:'',startDate:'2999-01-01',startTime:'09:00',endDate:'2999-01-01',endTime:'15:00',map:'',fee:'0',limit:'30',clubId:'',status:'published'};
  expect(validateEvent(f,true)).toBe('');expect(validateEvent({...f,endDate:''},true)).toMatch(/Choose the end/);expect(validateEvent({...f,endTime:'09:00'},true)).toMatch(/after the start/);expect(validateEvent({...f,endTime:'08:00'},true)).toMatch(/after the start/);
 });
});
describe('showing the end',()=>{
 it('event page shows the whole time span',async()=>{
  globalThis.__events=[ev({startsAt:ts(new Date('2999-10-12T20:00:00Z')),endsAt:ts(new Date('2999-10-13T02:30:00Z'))})];   // 9:00 am to 3:30 pm, 13 Oct NZ
  app('/event/e1');await signIn(null);await waitFor(()=>screen.getByText('When'));expect(screen.getByText(/13 Oct 2999, 9:00 am – 3:30 pm/)).toBeTruthy();
 });
 it('catalog cards show both days for a multi-day event',async()=>{
  globalThis.__events=[ev({startsAt:ts(new Date('2999-10-12T20:00:00Z')),endsAt:ts(new Date('2999-10-14T20:00:00Z'))})];
  app('/');await signIn(null);await waitFor(()=>screen.getByText('Taupō Cup'));expect(screen.getByText(/13 Oct 2999 – 15 Oct 2999/)).toBeTruthy();
 });
 it('an event under way is In progress and, by default, closed for registration; once over it is Finished',async()=>{
  globalThis.__events=[ev({startsAt:ts(-1),endsAt:ts(3)})];app('/event/e1');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Registration closed',{selector:'button'}));
  expect(screen.getByText('Registration closed',{selector:'button'}).disabled).toBe(true);expect(screen.getByText('In progress')).toBeTruthy();cleanup();
  globalThis.__events=[ev({startsAt:ts(-5),endsAt:ts(-1)})];app('/event/e1');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Finished',{selector:'button'}));
 });
});
