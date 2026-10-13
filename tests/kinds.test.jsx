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
import {closeAt,registrationOpen,regCloseText,status,kindLabel} from '../src/data';
const H=3600e3,ts=h=>({toDate:()=>new Date(Date.now()+h*H)});
const ev=o=>({id:'e1',name:'Taupō Cup',description:'',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',district:'',waterbody:'Lake Taupō',limit:10,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(48),endsAt:ts(52),...o});
const fb=(role,uid)=>({uid,displayName:'Pat',email:'p@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const app=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const fill=(l,v)=>fireEvent.change(screen.getByLabelText(l),{target:{value:v}});
const submit=()=>fireEvent.click(screen.getByRole('button',{name:/Submit for approval|Save event/}));
const radio=(group,label)=>[...screen.getByRole('group',{name:group}).querySelectorAll('input[type="radio"]')].find(i=>i.parentElement.textContent.trim()===label);
beforeEach(()=>{calls.length=0;globalThis.__events=[ev({})]});
afterEach(cleanup);
describe('event type: tournament or seminar',()=>{
 const form=async()=>{app('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/))};
 const basics=()=>{fill(/Event name/,'Fly Basics Day');fireEvent.click(screen.getByLabelText(/Freshwater fishing/));fill(/^Discipline/,'Fly');fill(/^Region/,'Waikato');fill(/Waterbody/,'Lake Taupō');fill(/Start date/,'2999-03-10')};
 it('defaults to Tournament and offers Seminar, with everything else unchanged',async()=>{
  await form();expect(radio('Event type','Tournament').checked).toBe(true);expect(radio('Event type','Seminar').checked).toBe(false);
  ['Fishing type','Format'].forEach(g=>expect(screen.getByRole('group',{name:g})).toBeTruthy());expect(screen.getByLabelText(/^Discipline/)).toBeTruthy();expect(screen.getByLabelText(/Participant limit/)).toBeTruthy();
 });
 it('saves the type',async()=>{
  await form();basics();submit();await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].kind).toBe('tournament');cleanup();calls.length=0;
  await form();basics();fireEvent.click(radio('Event type','Seminar'));submit();await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].kind).toBe('seminar');
 });
 it('shows the saved type when editing, and treats older events as tournaments',async()=>{
  globalThis.__events=[ev({kind:'seminar'})];app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));expect(radio('Event type','Seminar').checked).toBe(true);cleanup();
  globalThis.__events=[ev({})];app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));expect(radio('Event type','Tournament').checked).toBe(true);
 });
 it('is shown on the card and the event page, and can be filtered',async()=>{
  globalThis.__events=[ev({id:'e1',name:'Taupō Cup'}),ev({id:'e2',name:'Fly Basics Day',kind:'seminar'}),ev({id:'e3',name:'Harbour Cup',kind:'tournament'})];
  app('/');await signIn(null);await waitFor(()=>screen.getByText('Taupō Cup'));
  expect(screen.getAllByText('Tournament')).toHaveLength(2);expect(screen.getAllByText('Seminar')).toHaveLength(1);
  fireEvent.click(screen.getByText('More filters'));fireEvent.click([...screen.getByRole('group',{name:'Event type'}).querySelectorAll('button')].find(b=>b.textContent==='Seminars'));
  expect(screen.queryByText('Taupō Cup')).toBeNull();expect(screen.getByText('Fly Basics Day')).toBeTruthy();expect(screen.getByRole('button',{name:'Fewer filters (1)'})).toBeTruthy();
  fireEvent.click(screen.getByText('Clear all'));expect(screen.getByText('Taupō Cup')).toBeTruthy();cleanup();
  globalThis.__events=[ev({kind:'seminar'})];app('/event/e1');await signIn(null);await waitFor(()=>screen.getByText('Taupō Cup',{selector:'h1'}));expect(screen.getByText('Seminar')).toBeTruthy();
 });
 it('kindLabel',()=>{expect(kindLabel({kind:'seminar'})).toBe('Seminar');expect(kindLabel({})).toBe('Tournament')});
});
describe('when registration closes',()=>{
 const form=async()=>{app('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/))};
 const basics=()=>{fill(/Event name/,'Long Weekend Cup');fireEvent.click(screen.getByLabelText(/Sea fishing/));fill(/^Discipline/,'Spin');fill(/^Region/,'Wellington');fill(/Waterbody/,'Harbour');fill(/Start date/,'2999-03-10')};
 it('defaults to the start, and the organiser can choose the end',async()=>{
  await form();expect(radio('Registration closes','When the event starts').checked).toBe(true);basics();submit();await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].registrationCloses).toBe('start');cleanup();calls.length=0;
  await form();basics();fireEvent.click(radio('Registration closes','When the event ends'));expect(radio('Registration closes','When the event starts').checked).toBe(false);
  submit();await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].registrationCloses).toBe('end');
 });
 it('shows the saved choice when editing; older events close at the start',async()=>{
  globalThis.__events=[ev({registrationCloses:'end'})];app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));expect(radio('Registration closes','When the event ends').checked).toBe(true);cleanup();
  globalThis.__events=[ev({})];app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));expect(radio('Registration closes','When the event starts').checked).toBe(true);
 });
 it('rules: closing moment, open or closed, and the status shown',()=>{
  const now=new Date(),at=h=>new Date(now.getTime()+h*H),mk=(a,b,x={})=>({status:'published',limit:5,startsAt:at(a),endsAt:at(b),date:'2999-01-01',...x});
  expect(closeAt(mk(2,6)).getTime()).toBe(at(2).getTime());expect(closeAt(mk(2,6,{registrationCloses:'end'})).getTime()).toBe(at(6).getTime());
  expect(closeAt({status:'published',startsAt:at(2),registrationCloses:'end'}).getTime()).toBe(at(2).getTime());   // no end saved: falls back to the start
  const o=(a,b,c)=>registrationOpen(mk(a,b,c?{registrationCloses:c}:{}),now);
  expect([o(2,6),o(-1,3),o(-5,-1),o(2,6,'end'),o(-1,3,'end'),o(-5,-1,'end')]).toEqual([true,false,false,true,true,false]);
  expect(registrationOpen(mk(2,6,{status:'draft'}),now)).toBe(false);expect(registrationOpen(mk(2,6,{status:'cancelled'}),now)).toBe(false);
  expect([status(mk(-1,3),0),status(mk(-1,3,{registrationCloses:'end'}),0),status(mk(-1,3,{registrationCloses:'end'}),5),status(mk(-5,-1,{registrationCloses:'end'}),0)]).toEqual(['In progress','Registration open','Waitlist','Finished']);
  expect(regCloseText(mk(2,6))).toMatch(/\(when the event starts\)$/);expect(regCloseText(mk(2,6,{registrationCloses:'end'}))).toMatch(/\(when the event ends\)$/);
 });
 it('event page says when registration closes',async()=>{
  app('/event/e1');await signIn(null);await waitFor(()=>screen.getByText('Registration closes'));expect(screen.getByText(/when the event starts\)/)).toBeTruthy();cleanup();
  globalThis.__events=[ev({registrationCloses:'end'})];app('/event/e1');await signIn(null);await waitFor(()=>screen.getByText('Registration closes'));expect(screen.getByText(/when the event ends\)/)).toBeTruthy();
 });
 it('the Register button follows the rule',async()=>{
  const btn=async(o)=>{globalThis.__events=[ev(o)];app('/event/e1');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Registration closes'));const b=screen.getAllByRole('button').find(x=>['Register','Registration closed','Finished'].includes(x.textContent));const r=[b.textContent,b.disabled];cleanup();return r};
  expect(await btn({startsAt:ts(2),endsAt:ts(6)})).toEqual(['Register',false]);
  expect(await btn({startsAt:ts(-1),endsAt:ts(3)})).toEqual(['Registration closed',true]);
  expect(await btn({startsAt:ts(-1),endsAt:ts(3),registrationCloses:'end'})).toEqual(['Register',false]);
  expect(await btn({startsAt:ts(-5),endsAt:ts(-1),registrationCloses:'end'})).toEqual(['Finished',true]);
 });
});
