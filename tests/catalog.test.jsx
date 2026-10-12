// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1],path:a.slice(1).join('/')}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,cs}),
 setDoc:vi.fn(),updateDoc:vi.fn(),getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
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
const ts=d=>({toDate:()=>new Date(Date.now()+d*864e5)});
const ev=(id,name,o)=>({id,name,description:'',waterType:'Sea',discipline:'Spin',format:'Individual',region:'Wellington',district:'',waterbody:'Somewhere',limit:10,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(10),...o});
const fb=(role,uid='u1')=>({uid,displayName:'Pat',email:'p@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=()=>render(<MemoryRouter initialEntries={['/']}><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const open=async(u=null)=>{mount();await act(async()=>{await globalThis.__cb(u)});await waitFor(()=>screen.getByText('Taupō Fly Open'))};
const shown=()=>['Taupō Fly Open','Harbour Spin Cup','Raglan Surf Day','Old Kayak Race'].filter(n=>screen.queryByText(n));
const sel=(l,v)=>fireEvent.change(screen.getByLabelText(l),{target:{value:v}});
beforeEach(()=>{globalThis.__events=[
 ev('e1','Taupō Fly Open',{waterType:'Freshwater',discipline:'Fly',region:'Waikato',district:'Taupō',startsAt:ts(20)}),
 ev('e2','Harbour Spin Cup',{format:'Team'}),
 ev('e3','Raglan Surf Day',{discipline:'Surfcasting',region:'Waikato',district:'Waikato',startsAt:ts(5)}),
 ev('e4','Old Kayak Race',{discipline:'Kayak',region:'Otago',startsAt:ts(-10)})]});
afterEach(cleanup);
describe('basic search',()=>{
 it('offers only fishing type and region, with a button for the rest',async()=>{
  await open();
  expect(screen.getByRole('group',{name:'Fishing type'}).textContent).toMatch(/All waters.*Sea fishing.*Freshwater fishing/);expect(screen.getByLabelText('Region')).toBeTruthy();
  const more=screen.getByRole('button',{name:'More filters'});expect(more.getAttribute('aria-expanded')).toBe('false');
  ['Search','District','Status','Format'].forEach(l=>expect(screen.queryByLabelText(l)).toBeNull());expect(screen.queryByRole('group',{name:'Discipline'})).toBeNull();
  expect(shown()).toHaveLength(4);
 });
 it('filters by fishing type and region',async()=>{
  await open();fireEvent.click(screen.getByText('Sea fishing'));expect(shown()).toEqual(['Harbour Spin Cup','Raglan Surf Day','Old Kayak Race']);
  sel('Region','Waikato');expect(shown()).toEqual(['Raglan Surf Day']);expect(screen.getByText('Showing 1 of 4 events')).toBeTruthy();
  fireEvent.click(screen.getByText('Freshwater fishing'));expect(shown()).toEqual(['Taupō Fly Open']);
 });
});
describe('advanced search',()=>{
 it('opens and closes with More filters / Fewer filters',async()=>{
  await open();fireEvent.click(screen.getByRole('button',{name:'More filters'}));
  const btn=screen.getByRole('button',{name:'Fewer filters'});expect(btn.getAttribute('aria-expanded')).toBe('true');
  ['Search','Status','Format'].forEach(l=>expect(screen.getByLabelText(l)).toBeTruthy());
  expect(screen.getByRole('group',{name:'Discipline'}).textContent).toMatch(/All.*Fly.*Spin.*Surfcasting.*Boat.*Kayak.*Other/);expect(screen.queryByLabelText('District')).toBeNull();
  fireEvent.click(btn);expect(screen.queryByLabelText('Search')).toBeNull();
 });
 it('searches by text, discipline, status, format and district',async()=>{
  await open();fireEvent.click(screen.getByText('More filters'));
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'cup'}});expect(shown()).toEqual(['Harbour Spin Cup']);fireEvent.change(screen.getByLabelText('Search'),{target:{value:''}});
  fireEvent.click(within('Discipline','Fly'));expect(shown()).toEqual(['Taupō Fly Open']);fireEvent.click(within('Discipline','All'));
  sel('Status','Finished');expect(shown()).toEqual(['Old Kayak Race']);sel('Status','');
  sel('Format','Team');expect(shown()).toEqual(['Harbour Spin Cup']);sel('Format','');
  sel('Region','Waikato');sel('District','Taupō');expect(shown()).toEqual(['Taupō Fly Open']);sel('Region','');expect(screen.queryByLabelText('District')).toBeNull();expect(shown()).toHaveLength(4);
 });
 it('counts active advanced filters on the button, even when it is closed, and keeps applying them',async()=>{
  await open();fireEvent.click(screen.getByText('More filters'));
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'o'}});fireEvent.click(within('Discipline','Spin'));
  expect(screen.getByRole('button',{name:'Fewer filters (2)'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Fewer filters (2)'}));expect(screen.getByRole('button',{name:'More filters (2)'})).toBeTruthy();expect(shown()).toEqual(['Harbour Spin Cup']);
 });
 it('Clear all puts everything back',async()=>{
  await open();expect(screen.queryByText('Clear all')).toBeNull();
  fireEvent.click(screen.getByText('Sea fishing'));sel('Region','Wellington');fireEvent.click(screen.getByText('More filters'));sel('Format','Team');
  expect(shown()).toEqual(['Harbour Spin Cup']);fireEvent.click(screen.getByText('Clear all'));
  expect(shown()).toHaveLength(4);expect(screen.getByLabelText('Region').value).toBe('');expect(screen.getByLabelText('Format').value).toBe('');expect(screen.queryByText('Clear all')).toBeNull();expect(screen.getByRole('button',{name:'Fewer filters'})).toBeTruthy();
 });
});
describe('Create event is separate from the search',()=>{
 it('is only for organisers and above',async()=>{
  await open(null);expect(screen.queryByText('Create event')).toBeNull();cleanup();
  await open(fb('participant'));expect(screen.queryByText('Create event')).toBeNull();cleanup();
  await open(fb('organiser','o1'));expect(screen.getByText('Create event').getAttribute('href')).toBe('/event/new');
 });
 it('sits in the page header, outside the search box, whether the filters are open or closed',async()=>{
  await open(fb('organiser','o1'));
  const link=screen.getByText('Create event'),box=()=>screen.getByLabelText('Region').closest('.c');
  expect(box().contains(link)).toBe(false);expect(screen.getByRole('heading',{name:'Events'}).parentElement.contains(link)).toBe(true);
  fireEvent.click(screen.getByText('More filters'));expect(box().contains(link)).toBe(false);expect(box().contains(screen.getByLabelText('Search'))).toBe(true);
  fireEvent.click(screen.getByText('Sea fishing'));expect(screen.getByText('Create event')).toBeTruthy();
 });
});
function within(group,name){return [...screen.getByRole('group',{name:group}).querySelectorAll('button')].find(b=>b.textContent===name)}
