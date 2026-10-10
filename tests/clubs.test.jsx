// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[2]||'new1'}),collection:()=>({}),
 setDoc:async(r,d)=>{calls.push(['setDoc',r.id,d])},updateDoc:async(r,d)=>{calls.push(['updateDoc',r.id,d])},
 getDoc:async()=>({exists:()=>true,data:()=>({clubIds:globalThis.__mine||[]})}),
 onSnapshot:(q,ok)=>{ok({docs:(globalThis.__clubs||[]).map(c=>({id:c.id,data:()=>c}))});return()=>{}},
 query:x=>x,orderBy:x=>x,serverTimestamp:()=>'TS',arrayUnion:x=>({union:x}),arrayRemove:x=>({remove:x})}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async(r,f,o)=>{calls.push(['upload',r.p,o.contentType])},getDownloadURL:async()=>'https://img.example/c.webp',deleteObject:async r=>{calls.push(['delete',r.p])}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import App from '../src/App';
import {validate,toData,normUrl,safeUrl} from '../src/clubs';
import ImageDrop,{crop169} from '../src/ImageDrop';
const club={id:'k1',name:'Wellington Anglers',region:'Wellington',town:'Petone',waterTypes:['Sea'],disciplines:['Spin'],coverUrl:'',ownerId:'o1',tagline:'Harbour fishing'};
const fb=(role,uid='u1')=>({uid,displayName:'Test User',email:'t@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><AppProvider><App/></AppProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
beforeEach(()=>{calls.length=0;globalThis.__clubs=[club];globalThis.__mine=[]});
afterEach(cleanup);
describe('club rules in the form',()=>{
 const f={name:'Ab',tagline:'',description:'',waterTypes:['Sea'],disciplines:[],region:'Otago',town:'',email:'',website:'',social:'',founded:'',meetings:''};
 it('validates',()=>{
  expect(validate(f)).toBe('');
  expect(validate({...f,name:'A'})).toMatch(/name/);expect(validate({...f,waterTypes:[]})).toMatch(/Sea fishing/);expect(validate({...f,region:''})).toMatch(/region/i);
  expect(validate({...f,email:'nope'})).toMatch(/email/);expect(validate({...f,website:'javascript:alert(1)'})).toMatch(/website/);expect(validate({...f,founded:'1700'})).toMatch(/Founded/);
 });
 it('cleans web addresses and refuses unsafe ones',()=>{
  expect(normUrl('example.co.nz')).toBe('https://example.co.nz');expect(normUrl('')).toBe('');
  expect(safeUrl('javascript:alert(1)')).toBe('');expect(safeUrl(normUrl('javascript:alert(1)'))).toBe('');expect(safeUrl('https://localhost')).toBe('');expect(safeUrl('https://ok.nz')).toBe('https://ok.nz');
  expect(toData({...f,founded:'1999',website:'a.nz'})).toMatchObject({founded:1999,website:'https://a.nz',name:'Ab'});
 });
 it('trims images to 16:9',()=>{
  expect(crop169(1920,1080)).toMatchObject({sx:0,sy:0,sw:1920,sh:1080,ow:1280,oh:720});
  const s=crop169(1000,1000);expect(s.sw).toBe(1000);expect(Math.abs(s.sw/s.sh-16/9)).toBeLessThan(.01);expect(s.sy).toBeGreaterThan(0);
  const w=crop169(3000,1000);expect(w.sh).toBe(1000);expect(w.sx).toBeGreaterThan(0);
 });
});
describe('image drop area',()=>{
 const file=(name,type,size=10)=>new File([new Uint8Array(size)],name,{type});
 const drop=()=>{const onChange=vi.fn();render(<ImageDrop onChange={onChange}/>);return {onChange,input:screen.getByLabelText('Cover image file')}};
 it('rejects other file types and files over 2 MB',async()=>{
  const {onChange,input}=drop();
  await act(async()=>{fireEvent.change(input,{target:{files:[file('a.gif','image/gif')]}})});expect(screen.getByRole('status').textContent).toMatch(/JPEG, PNG or WebP/);
  await act(async()=>{fireEvent.change(input,{target:{files:[file('big.jpg','image/jpeg',2*1024*1024+1)]}})});expect(screen.getByRole('status').textContent).toMatch(/over 2 MB/);
  expect(onChange).not.toHaveBeenCalled();
 });
 it('accepts a good image, trims it, and can remove it',async()=>{
  globalThis.createImageBitmap=async()=>({width:1000,height:1000});URL.createObjectURL=()=>'blob:x';
  HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob(['x'],{type}))};
  const {onChange,input}=drop();
  await act(async()=>{fireEvent.change(input,{target:{files:[file('a.jpg','image/jpeg')]}})});
  expect(onChange).toHaveBeenCalledWith({file:expect.any(Blob)});expect(screen.getByRole('status').textContent).toMatch(/trimmed/);
  fireEvent.click(screen.getByText('Remove'));expect(onChange).toHaveBeenLastCalledWith({remove:true});
 });
 it('opens the file chooser from the keyboard',()=>{
  const {input}=drop();const click=vi.spyOn(input,'click');fireEvent.keyDown(screen.getByRole('button',{name:'Add cover image'}),{key:'Enter'});expect(click).toHaveBeenCalled();
 });
});
describe('clubs pages',()=>{
 it('lists clubs; only organisers and above see Create club',async()=>{
  mount('/clubs');await signIn(fb('participant'));await waitFor(()=>screen.getByText('Wellington Anglers'));expect(screen.queryByText('Create club')).toBeNull();cleanup();
  mount('/clubs');await signIn(fb('organiser'));await waitFor(()=>screen.getByText('Create club'));
 });
 it('joining a club saves it on the profile',async()=>{
  mount('/clubs');await signIn(fb('participant'));await waitFor(()=>screen.getByText('Join'));
  fireEvent.click(screen.getByText('Join'));
  expect(calls).toContainEqual(['updateDoc','u1',{clubIds:{union:'k1'}}]);await waitFor(()=>screen.getByText('Leave'));
 });
 it('a participant cannot open the editor',async()=>{
  mount('/clubs/new');await signIn(fb('participant'));await waitFor(()=>screen.getByRole('heading',{name:'Events'}));expect(screen.queryByText('Save club')).toBeNull();
 });
 it('creates a club without an image: saves the club first',async()=>{
  mount('/clubs/new');await signIn(fb('organiser'));await waitFor(()=>screen.getByText('Save club'));
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/name/);
  fireEvent.change(screen.getByLabelText(/Club name/),{target:{value:'Test Club'}});fireEvent.click(screen.getByLabelText(/Sea fishing/));fireEvent.change(screen.getByLabelText(/Region/),{target:{value:'Otago'}});
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));
  const [k,id,data]=calls[0];expect(k).toBe('setDoc');expect(id).toBe('new1');
  expect(data).toMatchObject({name:'Test Club',waterTypes:['Sea'],region:'Otago',ownerId:'u1',coverUrl:'',createdAt:'TS'});expect(calls.some(c=>c[0]==='upload')).toBe(false);
 });
 it('creates a club with an image: club, then upload, then cover link',async()=>{
  globalThis.createImageBitmap=async()=>({width:1920,height:1080});URL.createObjectURL=()=>'blob:x';
  HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob(['x'],{type}))};
  mount('/clubs/new');await signIn(fb('organiser'));await waitFor(()=>screen.getByText('Save club'));
  fireEvent.change(screen.getByLabelText(/Club name/),{target:{value:'Pic Club'}});fireEvent.click(screen.getByLabelText(/Freshwater fishing/));fireEvent.change(screen.getByLabelText(/Region/),{target:{value:'Waikato'}});
  await act(async()=>{fireEvent.change(screen.getByLabelText('Cover image file'),{target:{files:[new File([new Uint8Array(10)],'p.jpg',{type:'image/jpeg'})]}})});
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.filter(c=>c[0]==='updateDoc').length).toBe(1));
  expect(calls.map(c=>c[0])).toEqual(['setDoc','upload','updateDoc']);expect(calls[1]).toEqual(['upload','clubs/new1/cover','image/webp']);expect(calls[2][2]).toMatchObject({coverUrl:'https://img.example/c.webp'});
 });

 it('keeps the same input element while typing, so focus is not lost',async()=>{
  mount('/clubs/new');await signIn(fb('organiser'));await waitFor(()=>screen.getByText('Save club'));
  const before=screen.getByLabelText(/Club name/);before.focus();
  fireEvent.change(before,{target:{value:'A'}});fireEvent.change(screen.getByLabelText(/Club name/),{target:{value:'AB'}});
  const after=screen.getByLabelText(/Club name/);
  expect(after).toBe(before);expect(document.activeElement).toBe(before);
 });
 it('only the owner or an admin can edit',async()=>{
  mount('/clubs/k1/edit');await signIn(fb('organiser','o2'));await waitFor(()=>screen.getByText(/Only the club's owner/));cleanup();
  mount('/clubs/k1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Save club'));cleanup();
  mount('/clubs/k1/edit');await signIn(fb('admin','a1'));await waitFor(()=>screen.getByText('Save club'));
 });
});
