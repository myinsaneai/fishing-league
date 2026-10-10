// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({doc:vi.fn(),getDoc:async()=>({exists:()=>true}),setDoc:vi.fn(),serverTimestamp:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},call:()=>async()=>({data:{users:[]}})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import App from '../src/App';
const mount=()=>render(<MemoryRouter initialEntries={['/']}><AuthProvider><AppProvider><App/></AppProvider></AuthProvider></MemoryRouter>);
const open=async()=>{mount();await act(async()=>{await globalThis.__cb(null)});fireEvent.click(screen.getAllByText('Sign in')[0])};
const ua=v=>Object.defineProperty(navigator,'userAgent',{value:v,configurable:true});
const orig=navigator.userAgent;
afterEach(()=>{cleanup();ua(orig);delete window.visualViewport});
describe('sign-in sheet on phones',()=>{
 it('sizes itself to the visible area above the keyboard and cleans up',async()=>{
  const l={};window.visualViewport={height:300,offsetTop:20,addEventListener:(t,f)=>{l[t]=f},removeEventListener:vi.fn()};
  await open();const s=document.documentElement.style;
  expect(s.getPropertyValue('--vvh')).toBe('300px');expect(s.getPropertyValue('--vvt')).toBe('20px');expect(document.body.style.overflow).toBe('hidden');
  window.visualViewport.height=520;act(()=>l.resize());expect(s.getPropertyValue('--vvh')).toBe('520px');   // keyboard closes
  fireEvent.keyDown(window,{key:'Escape'});expect(s.getPropertyValue('--vvh')).toBe('');expect(document.body.style.overflow).toBe('');
 });
 it('works when the browser has no visualViewport',async()=>{await open();expect(screen.getByRole('dialog')).toBeTruthy()});
 it('explains and disables Google inside the Messenger/Facebook browser',async()=>{
  ua('Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile [FBAN/FBIOS;FBAV/450.0;Messenger]');await open();
  expect(screen.getByText(/does not work inside Messenger/)).toBeTruthy();expect(screen.getByText(/Continue with Google/).closest('button').disabled).toBe(true);
  expect(screen.getByLabelText('Email').disabled).toBe(false);
 });
 it('keeps Google enabled in normal browsers',async()=>{
  ua('Mozilla/5.0 (iPhone) Safari/604.1');await open();
  expect(screen.queryByText(/does not work inside Messenger/)).toBeNull();expect(screen.getByText(/Continue with Google/).closest('button').disabled).toBe(false);
 });
});
