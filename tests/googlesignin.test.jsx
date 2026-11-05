// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const creds=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(async()=>({})),signInWithCredential:vi.fn(async()=>({})),
 GoogleAuthProvider:class{static credential(idToken,accessToken){const c={providerId:'google.com',idToken,accessToken};creds.push(c);return c}},
 signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({doc:vi.fn(),getDoc:async()=>({exists:()=>true,data:()=>({})}),setDoc:vi.fn(),serverTimestamp:vi.fn(),updateDoc:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({data:{users:[]}})}));
import {signInWithPopup,signInWithCredential} from 'firebase/auth';
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {embeddedBrowser} from '../src/SignIn';
import App from '../src/App';
const CLIENT_ID='655530575506-0d4m2g8e0g1ohmgohj4ek1lvm4msbtke.apps.googleusercontent.com';
const mount=()=>render(<MemoryRouter initialEntries={['/']}><AuthProvider><AppProvider><App/></AppProvider></AuthProvider></MemoryRouter>);
const open=async()=>{mount();await act(async()=>{await globalThis.__cb(null)});fireEvent.click(screen.getAllByText('Sign in')[0])};
const ua=v=>Object.defineProperty(navigator,'userAgent',{value:v,configurable:true});
const orig=navigator.userAgent;
// A stand-in for Google's script: remembers how it was called, and lets a test play the answer.
const stubGoogle=()=>{const log={configs:[],requests:[]};window.google={accounts:{oauth2:{initTokenClient:cfg=>{log.configs.push(cfg);return {requestAccessToken:o=>{log.requests.push(o)}}}}}};return log};
const tap=()=>fireEvent.click(screen.getByText(/Continue with Google/).closest('button'));
beforeEach(()=>{creds.length=0;vi.clearAllMocks();delete window.google;document.head.querySelectorAll('script').forEach(s=>s.remove())});
afterEach(()=>{cleanup();ua(orig)});
describe('Google sign-in through Google Identity Services',()=>{
 it('opens Google\'s window straight from the tap (no Firebase popup), then signs in to Firebase with the token',async()=>{
  const g=stubGoogle();await open();tap();
  expect(g.configs).toHaveLength(1);expect(g.configs[0].client_id).toBe(CLIENT_ID);expect(g.configs[0].scope).toBe('openid email profile');
  expect(g.requests).toEqual([{prompt:'select_account'}]);            // already requested, in the same moment as the tap
  expect(signInWithPopup).not.toHaveBeenCalled();expect(signInWithCredential).not.toHaveBeenCalled();
  await act(async()=>{g.configs[0].callback({access_token:'tok-123'})});
  await waitFor(()=>expect(signInWithCredential).toHaveBeenCalledTimes(1));
  expect(creds).toEqual([{providerId:'google.com',idToken:null,accessToken:'tok-123'}]);expect(signInWithCredential.mock.calls[0][1]).toBe(creds[0]);
  await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());     // the dialog closes
 });
 it('says "cancelled" when the person closes the Google window or refuses, and does not sign in',async()=>{
  const g=stubGoogle();await open();tap();
  await act(async()=>{g.configs[0].error_callback({type:'popup_closed'})});
  await waitFor(()=>screen.getByText('Sign-in was cancelled.'));expect(signInWithCredential).not.toHaveBeenCalled();expect(screen.getByRole('dialog')).toBeTruthy();
  tap();await act(async()=>{g.configs[1].callback({error:'access_denied'})});
  await waitFor(()=>expect(screen.getAllByText('Sign-in was cancelled.').length).toBe(1));
 });
 it('explains a blocked pop-up, and shows other problems as they are',async()=>{
  const g=stubGoogle();await open();tap();
  await act(async()=>{g.configs[0].error_callback({type:'popup_failed_to_open'})});
  await waitFor(()=>screen.getByText(/The Google window was blocked/));
  tap();await act(async()=>{g.configs[1].error_callback({type:'unknown',message:'Something odd happened.'})});
  await waitFor(()=>screen.getByText('Something odd happened.'));
 });
 it('shows Firebase\'s message if it refuses the token',async()=>{
  signInWithCredential.mockRejectedValueOnce(Object.assign(new Error('Firebase says no.'),{code:'auth/account-exists-with-different-credential'}));
  const g=stubGoogle();await open();tap();await act(async()=>{g.configs[0].callback({access_token:'t'})});
  await waitFor(()=>screen.getByText('Firebase says no.'));expect(screen.getByRole('dialog')).toBeTruthy();
 });
 it('falls back to Firebase\'s own popup when Google\'s script is not available',async()=>{
  await open();tap();await waitFor(()=>expect(signInWithPopup).toHaveBeenCalledTimes(1));expect(signInWithCredential).not.toHaveBeenCalled();
 });
 it('loads Google\'s script once for signed-out visitors, and not for signed-in ones',async()=>{
  mount();await act(async()=>{await globalThis.__cb(null)});
  const src='script[src="https://accounts.google.com/gsi/client"]';expect(document.querySelectorAll(src)).toHaveLength(1);
  cleanup();mount();await act(async()=>{await globalThis.__cb(null)});expect(document.querySelectorAll(src)).toHaveLength(1);   // not added twice
  cleanup();document.head.querySelectorAll('script').forEach(s=>s.remove());
  mount();await act(async()=>{await globalThis.__cb({uid:'u1',displayName:'Pat',email:'p@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{}})})});
  expect(document.querySelectorAll(src)).toHaveLength(0);
 });
});
describe('built-in browsers of other apps',()=>{
 it('recognises them',()=>{
  const FB='Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile [FBAN/FBIOS;FBAV/450.0;Messenger]';
  expect(embeddedBrowser(FB)).toBe('blocked');expect(embeddedBrowser('Mozilla/5.0 (Linux; Android 14; SM-S921B) Instagram 300.0')).toBe('blocked');
  for(const x of ['Mozilla/5.0 (Linux; Android 14; SM-S921B; wv) AppleWebKit/537.36 Version/4.0 Chrome/130 Mobile Safari/537.36 Telegram-Android/10.0','Mozilla/5.0 (Linux; Android 13; wv) Chrome/120 VKAndroidApp/7.0','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Viber/20.0','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148','Mozilla/5.0 (Linux; Android 13; Pixel) Chrome/120 Mobile Safari/537.36 BytedanceWebview/d8a21c6','Mozilla/5.0 (Linux; Android 13) Line/13.0.0'])expect(embeddedBrowser(x)).toBe('maybe');
  for(const x of ['','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1','Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36'])expect(embeddedBrowser(x)).toBe('');
 });
 it('shows a hint but keeps Google on for the uncertain ones, and still disables it for Facebook and Messenger',async()=>{
  ua('Mozilla/5.0 (Linux; Android 14; SM-S921B; wv) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36 Telegram-Android/10.0');await open();
  expect(screen.getByText(/built-in browser of another app/)).toBeTruthy();expect(screen.getByText(/Continue with Google/).closest('button').disabled).toBe(false);
  cleanup();ua('Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile [FBAN/FBIOS;FBAV/450.0;Messenger]');await open();
  expect(screen.getByText(/does not work inside Messenger/)).toBeTruthy();expect(screen.getByText(/Continue with Google/).closest('button').disabled).toBe(true);expect(screen.queryByText(/built-in browser of another app/)).toBeNull();
 });
});
