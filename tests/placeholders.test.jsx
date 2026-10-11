// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[],sizes=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1],path:a.slice(1).join('/')}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,cs}),
 setDoc:async(r,d,o)=>{calls.push(['setDoc',r.path,d,o])},updateDoc:async()=>{},getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  if(q.path==='settings/placeholders'){ok({data:()=>globalThis.__ph||{}});return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):(globalThis.__clubs||[]),c=q.cs?.[0];
  const list=!c?src:c.f==='status'?src.filter(e=>c.op==='in'?c.v.includes(e.status):e.status===c.v):c.f==='ownerId'?src.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async(r,f,o)=>{calls.push(['upload',r.p,o.contentType])},getDownloadURL:async r=>'https://img.example/'+r.p,deleteObject:async r=>{calls.push(['delete',r.p])}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {PlaceholdersProvider} from '../src/placeholders';
import Cover from '../src/Cover';
import Avatar from '../src/Avatar';
import App from '../src/App';
import {cropTo} from '../src/ImageDrop';
const PH={club:'https://ph/club',event:'https://ph/event',avatar:'https://ph/avatar'};
const ts=d=>({toDate:()=>new Date(Date.now()+d*864e5)});
const fb=(role,uid,photoURL='')=>({uid,displayName:'Pat '+uid,email:uid+'@x.com',emailVerified:true,photoURL,getIdTokenResult:async()=>({claims:{role}})});
const app=path=>render(<MemoryRouter initialEntries={[path]}><PlaceholdersProvider><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></PlaceholdersProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const only=ui=>render(<PlaceholdersProvider>{ui}</PlaceholdersProvider>);
const img=()=>document.querySelector('img');
beforeEach(()=>{calls.length=0;sizes.length=0;globalThis.__ph={};globalThis.__clubs=[];globalThis.__events=[]});
afterEach(cleanup);
describe('placeholder pictures',()=>{
 it('crops to a square for profile pictures',()=>{
  expect(cropTo(1920,1080,1,512)).toEqual({sx:420,sy:0,sw:1080,sh:1080,ow:512,oh:512});
  expect(cropTo(400,300,1,512)).toMatchObject({sw:300,sh:300,ow:300,oh:300});
 });
 it('club and event photos fall back to the placeholder, then to a letter tile',()=>{
  globalThis.__ph=PH;only(<Cover c={{name:'Zed'}} kind="club"/>);expect(img().getAttribute('src')).toBe('https://ph/club');cleanup();
  only(<Cover c={{name:'Zed'}} kind="event"/>);expect(img().getAttribute('src')).toBe('https://ph/event');cleanup();
  globalThis.__ph={};const {container}=only(<Cover c={{name:'zed'}} kind="club"/>);expect(container.querySelector('img')).toBeNull();expect(container.textContent).toBe('Z');
 });
 it('a photo that cannot be loaded is replaced by the placeholder, and a broken placeholder by the tile',()=>{
  globalThis.__ph=PH;const {container}=only(<Cover c={{name:'Zed',coverUrl:'https://broken/pic.jpg'}} kind="club" alt="Zed"/>);
  expect(img().getAttribute('src')).toBe('https://broken/pic.jpg');fireEvent.error(img());expect(img().getAttribute('src')).toBe('https://ph/club');
  fireEvent.error(img());expect(container.querySelector('img')).toBeNull();expect(container.textContent).toBe('Z');
 });
 it('profile pictures work the same way, with the initial as the last resort',()=>{
  globalThis.__ph=PH;const {container}=only(<Avatar url="https://broken/me.jpg" name="Pat"/>);
  fireEvent.error(img());expect(img().getAttribute('src')).toBe('https://ph/avatar');fireEvent.error(img());expect(container.textContent).toBe('P');cleanup();
  only(<Avatar name="Quinn"/>);expect(img().getAttribute('src')).toBe('https://ph/avatar');
 });
 it('shows the event placeholder on catalog cards and the avatar placeholder on My page',async()=>{
  globalThis.__ph=PH;globalThis.__events=[{id:'e1',name:'Cup',waterType:'Sea',discipline:'Spin',format:'Individual',region:'Otago',waterbody:'Harbour',limit:5,fee:0,status:'published',ownerId:'o1',ownerName:'O',startsAt:ts(5)}];
  app('/');await signIn(null);await waitFor(()=>screen.getByText('Cup'));expect(document.querySelector('img.cover').getAttribute('src')).toBe('https://ph/event');cleanup();
  app('/me');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Send evidence'));expect(document.querySelector('img[src="https://ph/avatar"]')).toBeTruthy();
 });
});
describe('Admin → Placeholders',()=>{
 const stub=()=>{globalThis.createImageBitmap=async()=>({width:1920,height:1080});URL.createObjectURL=()=>'blob:x';HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});HTMLCanvasElement.prototype.toBlob=function(cb,type){sizes.push([this.width,this.height]);cb(new Blob(['x'],{type}))}};
 const open=async()=>{app('/admin');await signIn(fb('superadmin','s1'));await waitFor(()=>screen.getByText('Placeholders'));fireEvent.click(screen.getByText('Placeholders'))};
 const choose=async(i)=>{await act(async()=>{fireEvent.change(screen.getAllByLabelText('Cover image file')[i],{target:{files:[new File([new Uint8Array(10)],'p.jpg',{type:'image/jpeg'})]}})})};
 it('only a superadmin sees the tab',async()=>{
  app('/admin');await signIn(fb('admin','a1'));await waitFor(()=>screen.getByText('Approvals'));expect(screen.queryByText('Placeholders')).toBeNull();
 });
 it('uploads a club placeholder and a square profile placeholder',async()=>{
  stub();await open();expect(screen.getByText('Club photo')).toBeTruthy();expect(screen.getByText('Event photo')).toBeTruthy();expect(screen.getByText('Profile picture')).toBeTruthy();
  expect(screen.getAllByText('Save').every(b=>b.disabled)).toBe(true);
  await choose(0);fireEvent.click(screen.getAllByText('Save')[0]);await waitFor(()=>expect(calls.some(c=>c[0]==='setDoc')).toBe(true));
  expect(calls[0]).toEqual(['upload','placeholders/club','image/webp']);
  expect(calls[1]).toEqual(['setDoc','settings/placeholders',{club:'https://img.example/placeholders/club',updatedAt:'TS'},{merge:true}]);
  calls.length=0;await choose(2);fireEvent.click(screen.getAllByText('Save')[2]);await waitFor(()=>expect(calls.some(c=>c[0]==='setDoc')).toBe(true));
  expect(calls[0]).toEqual(['upload','placeholders/avatar','image/webp']);expect(calls[1][2]).toMatchObject({avatar:'https://img.example/placeholders/avatar'});
  expect(sizes).toContainEqual([1280,720]);expect(sizes).toContainEqual([512,512]);
 });
 it('removes a placeholder',async()=>{
  globalThis.__ph={club:'https://ph/club'};stub();await open();
  fireEvent.click(screen.getAllByText('Remove')[0]);fireEvent.click(screen.getAllByText('Save')[0]);await waitFor(()=>expect(calls.some(c=>c[0]==='setDoc')).toBe(true));
  expect(calls[0]).toEqual(['delete','placeholders/club']);expect(calls[1][2]).toMatchObject({club:'',updatedAt:'TS'});
 });
});
