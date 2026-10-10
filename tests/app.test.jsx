// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,act,waitFor,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({doc:vi.fn(),getDoc:async()=>({exists:()=>true}),setDoc:vi.fn(),serverTimestamp:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},call:()=>async()=>({data:{users:[{uid:'u2',email:'a@x.com',name:'Ann',photo:'',providers:['google.com'],disabled:false,verified:true,created:'',lastSignIn:'',role:'participant'}]}})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import App from '../src/App';
const fb=role=>({uid:'a1',displayName:'Admin',email:'admin@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppProvider><App/></AppProvider></AuthProvider></MemoryRouter>);
afterEach(cleanup);
describe('routing guards',()=>{
 it('logging out on /admin lands on the start page',async()=>{
  mount('/admin');await act(async()=>{await globalThis.__cb(fb('admin'))});await waitFor(()=>screen.getByText('Ann'));
  await act(async()=>{await globalThis.__cb(null)});
  await waitFor(()=>screen.getByRole('heading',{name:'Events'}));expect(screen.queryByText('Admins only.')).toBeNull();
 });
 it('refreshing /me waits for the session instead of redirecting',async()=>{
  mount('/me');expect(screen.getByText('Loading…')).toBeTruthy();
  await act(async()=>{await globalThis.__cb(fb('participant'))});
  await waitFor(()=>screen.getByText('Send evidence'));
 });
 it('a participant is sent away from /admin, a guest from /manage',async()=>{
  mount('/admin');await act(async()=>{await globalThis.__cb(fb('participant'))});await waitFor(()=>screen.getByRole('heading',{name:'Events'}));cleanup();
  mount('/manage');await act(async()=>{await globalThis.__cb(null)});await waitFor(()=>screen.getByRole('heading',{name:'Events'}));
 });
});
describe('sign-in sheet',()=>{
 it('stays open when a press starts inside and the click lands on the backdrop; closes on a real backdrop tap and Escape',async()=>{
  mount('/');await act(async()=>{await globalThis.__cb(null)});
  fireEvent.click(screen.getAllByText('Sign in')[0]);
  const email=screen.getByLabelText('Email'),backdrop=screen.getByRole('dialog');
  fireEvent.pointerDown(email);fireEvent.click(backdrop);           // drag-select ending outside
  expect(screen.queryByRole('dialog')).toBeTruthy();
  fireEvent.pointerDown(backdrop);fireEvent.click(backdrop);        // genuine tap outside
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getAllByText('Sign in')[0]);expect(screen.queryByRole('dialog')).toBeTruthy();
  fireEvent.keyDown(window,{key:'Escape'});expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('typing and clearing fields does not close it',async()=>{
  mount('/');await act(async()=>{await globalThis.__cb(null)});fireEvent.click(screen.getAllByText('Sign in')[0]);
  const pw=screen.getByLabelText('Password');fireEvent.change(pw,{target:{value:'abc123'}});fireEvent.change(pw,{target:{value:''}});
  expect(screen.queryByRole('dialog')).toBeTruthy();
 });
});
describe('layout and filters',()=>{
 it('has the menu links in the header and no hamburger',async()=>{
  mount('/');await act(async()=>{await globalThis.__cb(fb('admin'))});
  expect(screen.queryByLabelText('Open menu')).toBeNull();
  const nav=screen.getByRole('navigation',{name:'Main'});['Events','Clubs','My page','Manage','Admin'].forEach(t=>expect(nav.textContent).toContain(t));
 });
 it('Sea / Freshwater filter works and has no Other',async()=>{
  mount('/');await act(async()=>{await globalThis.__cb(null)});
  const grp=screen.getByRole('group',{name:'Fishing type'});expect(grp.textContent).not.toContain('Other');
  expect(screen.getByText('Taupō Fly Open')).toBeTruthy();
  fireEvent.click(screen.getByText('Sea fishing'));
  expect(screen.queryByText('Taupō Fly Open')).toBeNull();expect(screen.getByText('Harbour Spin Cup')).toBeTruthy();
  fireEvent.click(screen.getByText('Freshwater fishing'));
  expect(screen.getByText('Taupō Fly Open')).toBeTruthy();expect(screen.queryByText('Harbour Spin Cup')).toBeNull();
 });
});
