// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[2]||'new1'}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({cs}),
 setDoc:async(r,d)=>{calls.push(['setDoc',r.id,d])},updateDoc:async(r,d)=>{calls.push(['updateDoc',r.id,d])},
 getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  const all=globalThis.__events||[],c=q.cs?.[0];
  const list=!c?(q.name==='events'?all:[]):c.f==='status'?all.filter(e=>c.v.includes(e.status)):c.f==='ownerId'?all.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async(r,f,o)=>{calls.push(['upload',r.p,o.contentType])},getDownloadURL:async()=>'https://img.example/e.webp',deleteObject:async()=>{}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import App from '../src/App';
import {validateEvent,toEventData} from '../src/events';
import {REGIONS,DISTRICTS,status} from '../src/data';
const ts=days=>({toDate:()=>new Date(Date.now()+days*864e5)});
const ev=(o)=>({id:'e1',name:'Taupō Fly Open',description:'Bring your own rod.\nBe kind.',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',district:'Taupō',waterbody:'Lake Taupō',meetingPoint:'Boat ramp',limit:10,fee:20,status:'published',coverUrl:'https://img.example/c.webp',ownerId:'o1',ownerName:'Olivia Organiser',clubId:'',startsAt:ts(20),...o});
const fb=(role,uid='u1')=>({uid,displayName:'Test User',email:'t@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
beforeEach(()=>{calls.length=0;globalThis.__events=[ev({}),ev({id:'e2',name:'Harbour Spin Cup',waterType:'Sea',discipline:'Spin',region:'Wellington',district:'',coverUrl:''}),ev({id:'e3',name:'Secret Draft',status:'draft',ownerId:'o1',coverUrl:''})]});
afterEach(cleanup);
const fill=(l,v)=>fireEvent.change(screen.getByLabelText(l),{target:{value:v}});
describe('wider NZ regions',()=>{
 it('includes the extra regions and districts such as Manawatū-Whanganui → Ruapehu',()=>{
  ['Manawatū-Whanganui','Taranaki','Gisborne','Southland','Tasman','Nelson','Marlborough','West Coast',"Hawke's Bay",'Chatham Islands'].forEach(r=>expect(REGIONS).toContain(r));
  expect(DISTRICTS['Manawatū-Whanganui']).toEqual(expect.arrayContaining(['Ruapehu','Manawatū','Horowhenua']));
  Object.keys(DISTRICTS).forEach(r=>expect(REGIONS).toContain(r));
 });
 it('catalog offers a district list once a region is chosen',async()=>{
  mount('/');await signIn(null);await waitFor(()=>screen.getByText('Taupō Fly Open'));
  expect(screen.queryByLabelText('District')).toBeNull();
  fireEvent.change(screen.getByLabelText('Region'),{target:{value:'Manawatū-Whanganui'}});
  expect(screen.getByLabelText('District').textContent).toContain('Ruapehu');
 });
});
describe('event form rules',()=>{
 const f={name:'Spring Cup',description:'',waterType:'Sea',discipline:'Spin',disciplineOther:'',format:'Individual',region:'Otago',district:'',waterbody:'Otago Harbour',meetingPoint:'',startsAt:'2999-01-01T09:00',fee:'0',limit:'30',clubId:'',status:'published'};
 it('validates',()=>{
  expect(validateEvent(f,true)).toBe('');
  expect(validateEvent({...f,name:'ab'},true)).toMatch(/name/);expect(validateEvent({...f,waterType:''},true)).toMatch(/Sea fishing/);
  expect(validateEvent({...f,discipline:'Other'},true)).toMatch(/discipline/);expect(validateEvent({...f,region:''},true)).toMatch(/region/i);
  expect(validateEvent({...f,startsAt:'2000-01-01T09:00'},true)).toMatch(/future/);expect(validateEvent({...f,startsAt:'2000-01-01T09:00'},false)).toBe('');
  expect(validateEvent({...f,fee:'12.345'},true)).toMatch(/fee/);expect(validateEvent({...f,limit:'0'},true)).toMatch(/limit/);
 });
 it('builds the saved data',()=>{
  const d=toEventData({...f,discipline:'Other',disciplineOther:' Spearfishing ',fee:'12.5',limit:'40'});
  expect(d).toMatchObject({discipline:'Other',disciplineOther:'Spearfishing',fee:12.5,limit:40,waterType:'Sea',status:'published'});expect(d.startsAt).toBeInstanceOf(Date);
 });
 it('status shows Cancelled and Draft ahead of other states',()=>{
  expect(status({status:'cancelled',date:'2999-01-01',limit:5},0)).toBe('Cancelled');expect(status({status:'draft',date:'2999-01-01',limit:5},0)).toBe('Draft');
 });
});
describe('events from Firestore',()=>{
 it('guests see published events only; owners also see their drafts',async()=>{
  mount('/');await signIn(null);await waitFor(()=>screen.getByText('Taupō Fly Open'));expect(screen.getByText('Harbour Spin Cup')).toBeTruthy();expect(screen.queryByText('Secret Draft')).toBeNull();expect(screen.queryByText('Create event')).toBeNull();cleanup();
  mount('/');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Secret Draft'));expect(screen.getByText('Create event')).toBeTruthy();
 });
 it('event page shows description, photo, edit link for the owner only, and a cancelled event cannot be joined',async()=>{
  mount('/event/e1');await signIn(fb('organiser','o2'));await waitFor(()=>screen.getByText(/Bring your own rod/));
  expect(screen.getByAltText('Taupō Fly Open photo')).toBeTruthy();expect(screen.queryByText('Edit event')).toBeNull();expect(screen.getByText(/Boat ramp/)).toBeTruthy();cleanup();
  mount('/event/e1');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Edit event'));cleanup();
  globalThis.__events=[ev({status:'cancelled'})];mount('/event/e1');await signIn(fb('participant'));await waitFor(()=>screen.getByText('Cancelled',{selector:'button'}));
  expect(screen.getByText('Cancelled',{selector:'button'}).disabled).toBe(true);
 });
 it('only the organiser who made it, or an admin, can open the editor',async()=>{
  mount('/event/e1/edit');await signIn(fb('organiser','o2'));await waitFor(()=>screen.getByText(/Only the organiser who created/));cleanup();
  mount('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Save event'));cleanup();
  mount('/event/e1/edit');await signIn(fb('admin','a1'));await waitFor(()=>screen.getByText('Save event'));
 });
});
describe('event form',()=>{
 const ready=async()=>{mount('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Save event'))};
 it('keeps focus: the same input element survives typing',async()=>{
  await ready();const before=screen.getByLabelText(/Event name/);before.focus();
  fireEvent.change(before,{target:{value:'A'}});fireEvent.change(screen.getByLabelText(/Event name/),{target:{value:'AB'}});
  expect(screen.getByLabelText(/Event name/)).toBe(before);expect(document.activeElement).toBe(before);
 });
 it('district list follows the region and resets when it changes',async()=>{
  await ready();expect(screen.queryByLabelText(/District or area/)).toBeNull();
  fill(/^Region/,'Manawatū-Whanganui');const d=screen.getByLabelText(/District or area/);expect(d.textContent).toContain('Ruapehu');
  fireEvent.change(d,{target:{value:'Ruapehu'}});expect(screen.getByLabelText(/District or area/).value).toBe('Ruapehu');
  fill(/^Region/,'Southland');expect(screen.getByLabelText(/District or area/).value).toBe('');
  fill(/^Region/,'Auckland');expect(screen.queryByLabelText(/District or area/)).toBeNull();
 });
 it('creates an event: saves it first, then the photo, then links the photo',async()=>{
  globalThis.createImageBitmap=async()=>({width:1920,height:1080});URL.createObjectURL=()=>'blob:x';
  HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob(['x'],{type}))};
  await ready();
  fireEvent.click(screen.getByText('Save event'));await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/name/);
  fill(/Event name/,'Ruapehu Trout Day');fireEvent.click(screen.getByLabelText(/Freshwater fishing/));fill(/^Discipline/,'Fly');fill(/^Region/,'Manawatū-Whanganui');fill(/Waterbody/,'Tongariro River');fill(/Start date/,'2999-05-10T09:00');
  await act(async()=>{fireEvent.change(screen.getByLabelText('Cover image file'),{target:{files:[new File([new Uint8Array(10)],'p.jpg',{type:'image/jpeg'})]}})});
  fireEvent.click(screen.getByText('Save event'));await waitFor(()=>expect(calls.filter(c=>c[0]==='updateDoc').length).toBe(1));
  expect(calls.map(c=>c[0])).toEqual(['setDoc','upload','updateDoc']);
  expect(calls[0][2]).toMatchObject({name:'Ruapehu Trout Day',waterType:'Freshwater',discipline:'Fly',region:'Manawatū-Whanganui',waterbody:'Tongariro River',ownerId:'o1',status:'published',coverUrl:'',createdAt:'TS',limit:30,fee:0});
  expect(calls[0][2].startsAt).toBeInstanceOf(Date);expect(calls[1]).toEqual(['upload','events/new1/cover','image/webp']);expect(calls[2][2]).toMatchObject({coverUrl:'https://img.example/e.webp'});
 });
});
