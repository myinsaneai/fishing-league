// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),
 updateProfile:async(u,p)=>{calls.push(['updateProfile',p]);Object.assign(u,{photoURL:p.photoURL})},sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1],path:a.slice(1).join('/')}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,cs}),
 setDoc:async(r,d)=>{calls.push(['setDoc',r.id,d])},updateDoc:async(r,d)=>{calls.push(['updateDoc',r.path,d])},getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  if(q.path==='settings/placeholders'){ok({data:()=>({})});return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):(globalThis.__clubs||[]),c=q.cs?.[0];
  const list=!c?src:c.f==='status'?src.filter(e=>c.op==='in'?c.v.includes(e.status):e.status===c.v):c.f==='ownerId'?src.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async(r,f,o)=>{calls.push(['upload',r.p,o.contentType])},getDownloadURL:async r=>'https://img.example/'+r.p,deleteObject:async r=>{calls.push(['delete',r.p])}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {auth} from '../src/firebase';
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {PlaceholdersProvider} from '../src/placeholders';
import App from '../src/App';
import {nzToDate} from '../src/time';
const ts=d=>({toDate:()=>d instanceof Date?d:new Date(Date.now()+d*864e5)});
const LONG='https://www.google.com/maps/place/Lake+Taupo/@-38.8,175.9,12z/data=!3m1';
const club=o=>({id:'c1',name:'Taupō Anglers',status:'approved',region:'Waikato',town:'Taupō',waterTypes:['Freshwater'],disciplines:[],coverUrl:'',ownerId:'o1',ownerName:'Olivia',createdAt:ts(-2),...o});
const event=o=>({id:'e1',name:'Taupō Cup',description:'Fish!',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',waterbody:'Lake Taupō',limit:10,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(30),createdAt:ts(-1),...o});
const fb=(role,uid,photoURL='')=>{const u={uid,displayName:'Pat '+uid,email:uid+'@x.com',emailVerified:true,photoURL,getIdTokenResult:async()=>({claims:{role}})};auth.currentUser=u;return u};
const app=path=>render(<MemoryRouter initialEntries={[path]}><PlaceholdersProvider><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></PlaceholdersProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const stub=()=>{globalThis.createImageBitmap=async()=>({width:1920,height:1080});URL.createObjectURL=()=>'blob:x';HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob(['x'],{type}))}};
const fill=(l,v)=>fireEvent.change(screen.getByLabelText(l),{target:{value:v}});
beforeEach(()=>{calls.length=0;globalThis.__clubs=[club({})];globalThis.__events=[event({})]});
afterEach(cleanup);
describe('event date and time',()=>{
 it('uses a date field and a time list instead of the combined picker',async()=>{
  const {container}=app('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));
  expect(container.querySelector('input[type="datetime-local"]')).toBeNull();expect(screen.getByLabelText(/Start date/).type).toBe('date');
  const opts=[...screen.getByLabelText(/^Start time/).querySelectorAll('option')].map(o=>o.textContent);
  expect(opts).toHaveLength(96);expect(opts).toContain('5:30 am');expect(opts).toContain('1:15 pm');expect(screen.getByLabelText(/^Start time/).value).toBe('07:00');
 });
 it('saves the chosen date and time as that moment on a New Zealand clock',async()=>{
  await act(async()=>{});app('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));
  fill(/Event name/,'Dawn Cup');fireEvent.click(screen.getByLabelText(/Freshwater fishing/));fill(/^Discipline/,'Fly');fill(/^Region/,'Waikato');fill(/Waterbody/,'Lake Taupō');
  fill(/Start date/,'2999-01-20');fill(/^Start time/,'05:45');
  fireEvent.click(screen.getByRole('button',{name:/Submit for approval/}));await waitFor(()=>expect(calls.some(c=>c[0]==='setDoc')).toBe(true));
  expect(calls[0][2].startsAt.toISOString()).toBe(nzToDate('2999-01-20','05:45').toISOString());
 });
 it('shows an existing event on the New Zealand clock when editing',async()=>{
  globalThis.__events=[event({startsAt:ts(new Date('2026-10-11T20:00:00Z'))})];   // 9:00 am on 12 October in New Zealand
  app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));
  expect(screen.getByLabelText(/Start date/).value).toBe('2026-10-12');expect(screen.getByLabelText(/^Start time/).value).toBe('09:00');
 });
 it('keeps an older start time that is not on the 15-minute grid',async()=>{
  globalThis.__events=[event({startsAt:ts(new Date('2026-10-11T17:10:00Z'))})];   // 6:10 am
  app('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/^Start time/));
  expect(screen.getByLabelText(/^Start time/).value).toBe('06:10');expect([...screen.getByLabelText(/^Start time/).querySelectorAll('option')].map(o=>o.textContent)).toContain('6:10 am');
 });
});
describe('Google Maps location',()=>{
 it('club form: shows feedback, blocks a bad link, and saves the location',async()=>{
  app('/clubs/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Save club'));
  fill(/Club name/,'Map Club');fireEvent.click(screen.getByLabelText(/Sea fishing/));fill(/^Region/,'Waikato');
  fill(/Map location/,'https://evil.com/maps/x');expect(screen.getAllByRole('alert')[0].textContent).toMatch(/Google Maps link/);
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(screen.getAllByRole('alert').length).toBeGreaterThan(1));expect(calls.length).toBe(0);
  fill(/Map location/,LONG);expect(screen.getByText(/Location found/)).toBeTruthy();
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));
  expect(calls[0][2]).toMatchObject({mapUrl:LONG,lat:-38.8,lng:175.9});
 });
 it('event form: saves coordinates typed in directly',async()=>{
  app('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByLabelText(/Start date/));
  fill(/Event name/,'Coord Cup');fireEvent.click(screen.getByLabelText(/Sea fishing/));fill(/^Discipline/,'Spin');fill(/^Region/,'Wellington');fill(/Waterbody/,'Harbour');fill(/Start date/,'2999-02-02');
  fill(/Map location/,'-41.2865, 174.7762');fireEvent.click(screen.getByRole('button',{name:/Submit for approval/}));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));
  expect(calls[0][2]).toMatchObject({mapUrl:'https://www.google.com/maps?q=-41.2865,174.7762',lat:-41.2865,lng:174.7762});
 });
 it('club and event pages show a map and links when there are coordinates',async()=>{
  globalThis.__clubs=[club({mapUrl:LONG,lat:-38.8,lng:175.9})];globalThis.__events=[event({mapUrl:LONG,lat:-38.8,lng:175.9})];
  app('/clubs/c1');await signIn(null);await waitFor(()=>screen.getByTitle(/Map of Taupō Anglers/));
  expect(screen.getByTitle(/Map of/).getAttribute('src')).toContain('output=embed');expect(screen.getByText('Open in Google Maps').getAttribute('href')).toBe(LONG);
  expect(screen.getByText('Directions').getAttribute('href')).toContain('destination=-38.8,175.9');cleanup();
  app('/event/e1');await signIn(null);await waitFor(()=>screen.getByTitle(/Map of Taupō Cup/));expect(screen.getByText('Open in Google Maps')).toBeTruthy();
 });
 it('a short link gets a button but no embedded map; no location shows nothing; an unsafe stored link is ignored',async()=>{
  globalThis.__clubs=[club({mapUrl:'https://maps.app.goo.gl/abc'})];app('/clubs/c1');await signIn(null);await waitFor(()=>screen.getByText('Open in Google Maps'));
  expect(screen.queryByTitle(/Map of/)).toBeNull();expect(screen.queryByText('Directions')).toBeNull();cleanup();
  globalThis.__clubs=[club({})];app('/clubs/c1');await signIn(null);await waitFor(()=>screen.getByText('Taupō Anglers',{selector:'h1'}));expect(screen.queryByText('Location')).toBeNull();cleanup();
  globalThis.__clubs=[club({mapUrl:'https://evil.com/maps/x',lat:1,lng:2})];app('/clubs/c1');await signIn(null);await waitFor(()=>screen.getByText('Taupō Anglers',{selector:'h1'}));
  expect(screen.queryByText('Open in Google Maps')).toBeNull();expect(screen.queryByTitle(/Map of/)).toBeNull();
 });
});
describe('changing my own picture',()=>{
 it('uploads a new picture and saves it on the sign-in profile and the users document',async()=>{
  stub();app('/me');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Change picture'));
  fireEvent.click(screen.getByText('Change picture'));expect(screen.getByText('Save picture').disabled).toBe(true);
  await act(async()=>{fireEvent.change(screen.getByLabelText('Cover image file'),{target:{files:[new File([new Uint8Array(10)],'me.jpg',{type:'image/jpeg'})]}})});
  fireEvent.click(screen.getByText('Save picture'));await waitFor(()=>screen.getByText('Picture updated.'));
  expect(calls).toEqual([['upload','avatars/u1','image/webp'],['updateProfile',{photoURL:'https://img.example/avatars/u1'}],['updateDoc','users/u1',{photoURL:'https://img.example/avatars/u1'}]]);
  expect(document.querySelector('img[src="https://img.example/avatars/u1"]')).toBeTruthy();
 });
 it('removes the picture',async()=>{
  app('/me');await signIn(fb('participant','u1','https://img.example/old.jpg'));await waitFor(()=>screen.getByText('Change picture'));
  expect(document.querySelector('img[src="https://img.example/old.jpg"]')).toBeTruthy();
  fireEvent.click(screen.getByText('Change picture'));fireEvent.click(screen.getByText('Remove'));fireEvent.click(screen.getByText('Save picture'));await waitFor(()=>screen.getByText('Picture updated.'));
  expect(calls).toEqual([['delete','avatars/u1'],['updateProfile',{photoURL:null}],['updateDoc','users/u1',{photoURL:''}]]);
  expect(document.querySelector('img[src="https://img.example/old.jpg"]')).toBeNull();
 });
 it('cancel leaves everything as it was',async()=>{
  app('/me');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Change picture'));
  fireEvent.click(screen.getByText('Change picture'));fireEvent.click(screen.getByText('Cancel'));expect(screen.queryByText('Save picture')).toBeNull();expect(calls.length).toBe(0);
 });
});
