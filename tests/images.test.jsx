// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({doc:vi.fn(),collection:vi.fn(),where:vi.fn(),orderBy:vi.fn(),query:vi.fn(),setDoc:vi.fn(),updateDoc:vi.fn(),getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),onSnapshot:(q,ok)=>{ok({docs:[],data:()=>({})});return()=>{}},serverTimestamp:vi.fn(),arrayUnion:vi.fn(),arrayRemove:vi.fn()}));
vi.mock('firebase/storage',()=>({ref:vi.fn(),uploadBytes:vi.fn(),getDownloadURL:vi.fn(),deleteObject:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import App from '../src/App';
import ImageDrop from '../src/ImageDrop';
import {toJpeg,toPhoto} from '../src/imageTools';
const big=(name,type,size)=>new File([new Uint8Array(size)],name,{type});
const MB=1024*1024;
let canvases,ops,closed;
// A stand-in for the browser's image decoding and drawing, so sizes and the order of steps can be checked.
const stub=({w=4032,h=3024,sizeFor=()=>100*1024}={})=>{
 closed=0;canvases=[];ops=[];
 globalThis.createImageBitmap=async()=>({width:w,height:h,close(){closed++}});
 URL.createObjectURL=()=>'blob:x';URL.revokeObjectURL=()=>{};
 HTMLCanvasElement.prototype.getContext=function(){const cv=this;return {set fillStyle(v){ops.push(['fill',v])},set imageSmoothingQuality(v){ops.push(['smooth',v])},fillRect(){ops.push(['rect'])},drawImage(...a){ops.push(['draw',a.slice(1)])}}};
 HTMLCanvasElement.prototype.toBlob=function(cb,type,q){canvases.push({w:this.width,h:this.height,type,q});cb(new Blob([new Uint8Array(sizeFor(this.width,this.height,q))],{type}))};
};
afterEach(()=>{cleanup();delete globalThis.createImageBitmap;delete globalThis.Image});
describe('toJpeg',()=>{
 it('turns a 12 MP phone photo into a JPEG of at most 4 MP and frees the decoded picture',async()=>{
  stub();const r=await toPhoto(big('p.jpg','image/jpeg',12*MB));
  expect(r.blob.type).toBe('image/jpeg');expect(r.width*r.height).toBeLessThanOrEqual(4e6);expect(r.originalBytes).toBe(12*MB);expect(canvases[0].type).toBe('image/jpeg');expect(closed).toBe(1);
 });
 it('paints white first (so transparent PNGs do not turn black), then draws the picture',async()=>{
  stub();await toPhoto(big('p.png','image/png',MB));
  expect(ops.map(o=>o[0])).toEqual(['fill','rect','smooth','draw']);expect(ops[0][1]).toBe('#fff');expect(ops[2][1]).toBe('high');
 });
 it('lowers the quality, then the size, until the file fits',async()=>{
  stub({sizeFor:(w,h,q)=>Math.round(w*h*q*0.6)});   // about 3.1 MB at q .82 for 4 MP
  const r=await toJpeg(big('p.jpg','image/jpeg',10*MB),{maxMP:4,quality:.82,maxBytes:1*MB});
  expect(r.blob.size).toBeLessThanOrEqual(1*MB);expect(canvases.length).toBeGreaterThan(1);expect(canvases.map(c=>c.q).slice(0,3)).toEqual([.82,.72,.62]);
 });
 it('gives up with a clear message when it can never fit',async()=>{
  stub({sizeFor:()=>50*MB});
  await expect(toJpeg(big('p.jpg','image/jpeg',MB),{maxBytes:1*MB})).rejects.toThrow(/could not be made small enough/);expect(closed).toBe(1);
 });
 it('refuses a picture too big to handle safely on a phone',async()=>{
  stub({w:20000,h:10000});await expect(toPhoto(big('p.jpg','image/jpeg',MB))).rejects.toThrow(/too large to prepare/);expect(closed).toBe(1);
 });
 it('falls back to an image element when createImageBitmap is missing',async()=>{
  stub();delete globalThis.createImageBitmap;
  globalThis.Image=class{decode(){this.naturalWidth=3000;this.naturalHeight=2000;return Promise.resolve()}};
  const r=await toPhoto(big('p.jpg','image/jpeg',MB));expect(r.width*r.height).toBeLessThanOrEqual(4e6);expect(r.width/r.height).toBeCloseTo(1.5,2);
 });
 it('trims to a ratio and caps the width for covers',async()=>{
  stub();const r=await toJpeg(big('p.jpg','image/jpeg',9*MB),{ratio:16/9,maxW:1280,maxBytes:1.5*MB});
  expect([r.width,r.height]).toEqual([1280,720]);expect(r.trimmed).toBe(true);expect(canvases[0].q).toBe(.85);
 });
});
describe('drop area',()=>{
 const mount=()=>{const onChange=vi.fn();render(<ImageDrop onChange={onChange}/>);return {onChange,input:screen.getByLabelText('Cover image file')}};
 it('says it takes up to 15 MB',()=>{mount();expect(screen.getByText(/up to 15 MB/)).toBeTruthy()});
 it('takes a 15 MB photo, hands back only the small copy, and tells the person how much was saved',async()=>{
  stub();const {onChange,input}=mount();
  await act(async()=>{fireEvent.change(input,{target:{files:[big('p.jpg','image/jpeg',15*MB)]}})});
  expect(onChange).toHaveBeenCalledTimes(1);const {file}=onChange.mock.calls[0][0];expect(file.size).toBeLessThan(MB);expect(file.type).toBe('image/jpeg');
  expect(screen.getByRole('status').textContent).toMatch(/Ready to upload: 100 KB \(original 15\.0 MB\)/);
 });
 it('refuses a photo over 15 MB or of the wrong type, before doing any work',async()=>{
  stub();const {onChange,input}=mount();
  await act(async()=>{fireEvent.change(input,{target:{files:[big('p.jpg','image/jpeg',15*MB+1)]}})});expect(screen.getByRole('status').textContent).toMatch(/over 15 MB/);
  await act(async()=>{fireEvent.change(input,{target:{files:[big('p.gif','image/gif',MB)]}})});expect(screen.getByRole('status').textContent).toMatch(/JPEG, PNG or WebP/);
  expect(onChange).not.toHaveBeenCalled();expect(canvases.length).toBe(0);
 });
 it('shows the reason when a photo cannot be prepared',async()=>{
  stub({w:20000,h:10000});const {onChange,input}=mount();
  await act(async()=>{fireEvent.change(input,{target:{files:[big('p.jpg','image/jpeg',MB)]}})});expect(screen.getByRole('status').textContent).toMatch(/too large to prepare/);expect(onChange).not.toHaveBeenCalled();
 });
});
describe('evidence photo on My page',()=>{
 const open=async()=>{render(<MemoryRouter initialEntries={['/me']}><AuthProvider><AppProvider><App/></AppProvider></AuthProvider></MemoryRouter>);
  await act(async()=>{await globalThis.__cb({uid:'u1',displayName:'Pat',email:'p@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role:'participant'}})})});await waitFor(()=>screen.getByText('Send evidence'))};
 it('prepares a 14 MB photo and says what will be sent',async()=>{
  stub();await open();expect(screen.getByText('Send').disabled).toBe(true);
  await act(async()=>{fireEvent.change(screen.getByLabelText('Photo'),{target:{files:[big('catch.jpg','image/jpeg',14*MB)]}})});
  await waitFor(()=>screen.getByText(/Photo ready: 100 KB \(original 14\.0 MB\)/));expect(screen.getByText('Send').disabled).toBe(false);
 });
 it('refuses a photo over 15 MB and keeps Send disabled',async()=>{
  stub();await open();
  await act(async()=>{fireEvent.change(screen.getByLabelText('Photo'),{target:{files:[big('huge.jpg','image/jpeg',16*MB)]}})});
  expect(screen.getByText(/over 15 MB/)).toBeTruthy();expect(screen.getByText('Send').disabled).toBe(true);expect(canvases.length).toBe(0);
 });
});
