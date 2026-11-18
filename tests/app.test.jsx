// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach} from 'vitest';
import {render,screen,act,waitFor,fireEvent,cleanup,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({doc:vi.fn(),getDoc:async()=>({exists:()=>true}),setDoc:vi.fn(),serverTimestamp:vi.fn(),collection:()=>({}),query:()=>({}),where:()=>({}),
 onSnapshot:(q,ok)=>{ok({docs:(globalThis.__events||[]).map(e=>({id:e.id,data:()=>e}))});return()=>{}}}));
vi.mock('firebase/storage',()=>({ref:vi.fn(),uploadBytes:vi.fn(),getDownloadURL:vi.fn(),deleteObject:vi.fn()}));
const ev=(id,name,waterType,days)=>({id,name,waterType,discipline:'Spin',format:'Individual',region:'Waikato',waterbody:'Somewhere',limit:10,fee:0,status:'published',ownerId:'o1',ownerName:'Olivia',startsAt:{toDate:()=>new Date(Date.now()+days*864e5)}});
globalThis.__events=[ev('e1','Taupō Fly Open','Freshwater',20),ev('e2','Harbour Spin Cup','Sea',10)];
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({data:{users:[{uid:'u2',email:'a@x.com',name:'Ann',photo:'',providers:['google.com'],disabled:false,verified:true,created:'',lastSignIn:'',role:'participant'}]}})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {EventsProvider} from '../src/eventsStore';
import App from '../src/App';
const fb=role=>({uid:'a1',displayName:'Admin',email:'admin@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></AuthProvider></MemoryRouter>);
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
  const nav=screen.getByRole('navigation',{name:'Main'});['Events','Clubs','My page'].forEach(t=>expect(nav.textContent).toContain(t));
  ['Profile','Manage','Admin'].forEach(t=>expect(nav.textContent).not.toContain(t));   // these sit under My page, in a list that opens on a click
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
describe('My page menu in the header',()=>{
 const as=async(role,path='/')=>{mount(path);await act(async()=>{await globalThis.__cb(role?fb(role):null)})};
 const button=()=>within(screen.getByRole('navigation',{name:'Main'})).getByRole('button',{name:/^My page/});
 const items=()=>[...document.querySelectorAll('#my-menu a')].map(a=>a.textContent.trim()+' '+a.getAttribute('href'));
 const open=()=>fireEvent.click(button());
 it('is just a plain My page link for a participant, and nothing for a visitor',async()=>{
  await as('participant');const nav=within(screen.getByRole('navigation',{name:'Main'}));
  expect(nav.getByRole('link',{name:'My page'}).getAttribute('href')).toBe('/me');expect(nav.queryByRole('button',{name:/My page/})).toBeNull();cleanup();
  await as(null);expect(screen.queryByText('My page')).toBeNull();
 });
 it('gives an organiser a list under My page: Profile and Manage',async()=>{
  await as('organiser');expect(button().getAttribute('aria-expanded')).toBe('false');expect(document.getElementById('my-menu')).toBeNull();
  open();expect(button().getAttribute('aria-expanded')).toBe('true');expect(button().getAttribute('aria-controls')).toBe('my-menu');
  expect(items()).toEqual(['Profile /me','Manage /manage']);
  open();expect(document.getElementById('my-menu')).toBeNull();expect(button().getAttribute('aria-expanded')).toBe('false');   // the button closes it again
 });
 it('gives an admin Profile, Manage and Admin, and a superadmin the same',async()=>{
  await as('admin');open();expect(items()).toEqual(['Profile /me','Manage /manage','Admin /admin']);cleanup();
  await as('superadmin');open();expect(items()).toEqual(['Profile /me','Manage /manage','Admin /admin']);
 });
 it('closes on Escape and puts the focus back on the button',async()=>{
  await as('admin');open();fireEvent.keyDown(document.querySelector('#my-menu a'),{key:'Escape'});
  expect(document.getElementById('my-menu')).toBeNull();expect(document.activeElement).toBe(button());
 });
 it('closes on a click elsewhere or when the page is resized, but not on a click inside the list',async()=>{
  await as('admin');open();fireEvent.pointerDown(document.querySelector('#my-menu'));expect(document.getElementById('my-menu')).not.toBeNull();
  fireEvent.pointerDown(document.body);expect(document.getElementById('my-menu')).toBeNull();
  open();act(()=>{window.dispatchEvent(new Event('resize'))});expect(document.getElementById('my-menu')).toBeNull();
  open();act(()=>{document.dispatchEvent(new Event('scroll'))});expect(document.getElementById('my-menu')).toBeNull();
 });
 it('closes when focus leaves it with Tab, but not when it moves between its own links',async()=>{
  await as('admin');open();const [a,b]=document.querySelectorAll('#my-menu a');
  fireEvent.focusOut(a,{relatedTarget:b});expect(document.getElementById('my-menu')).not.toBeNull();
  fireEvent.focusOut(b,{relatedTarget:document.body});expect(document.getElementById('my-menu')).toBeNull();
 });
 it('opens with the Down arrow on the first item and moves with the arrow keys, wrapping round, Home and End',async()=>{
  await as('admin');button().focus();fireEvent.keyDown(button(),{key:'ArrowDown'});
  const links=()=>[...document.querySelectorAll('#my-menu a')],at=()=>links().indexOf(document.activeElement);
  expect(links().length).toBe(3);expect(at()).toBe(0);
  fireEvent.keyDown(document.activeElement,{key:'ArrowDown'});expect(at()).toBe(1);
  fireEvent.keyDown(document.activeElement,{key:'ArrowDown'});fireEvent.keyDown(document.activeElement,{key:'ArrowDown'});expect(at()).toBe(0);
  fireEvent.keyDown(document.activeElement,{key:'ArrowUp'});expect(at()).toBe(2);
  fireEvent.keyDown(document.activeElement,{key:'Home'});expect(at()).toBe(0);fireEvent.keyDown(document.activeElement,{key:'End'});expect(at()).toBe(2);
 });
 it('choosing an item goes to that page and closes the list; My page is underlined on those pages',async()=>{
  await as('admin');expect(button().className).not.toContain('active');
  open();fireEvent.click(screen.getByRole('link',{name:'Manage'}));
  await waitFor(()=>expect(document.getElementById('my-menu')).toBeNull());expect(button().className).toContain('active');
  open();expect(document.querySelector('#my-menu a.active').textContent.trim()).toBe('Manage');   // the page you are on is marked in the list
 });
 it('is underlined on Profile and Admin too, and not on Events',async()=>{
  await as('admin','/me');await waitFor(()=>expect(button().className).toContain('active'));cleanup();
  await as('admin','/admin');await waitFor(()=>expect(button().className).toContain('active'));cleanup();
  await as('admin','/');expect(button().className).not.toContain('active');
 });
 it('is placed from the button\'s position and kept inside the screen, so a phone\'s sideways-scrolling menu bar cannot cut it off',async()=>{
  Object.defineProperty(window,'innerWidth',{value:390,configurable:true});
  await as('admin');vi.spyOn(button(),'getBoundingClientRect').mockReturnValue({left:330,right:380,top:90,bottom:130,width:50,height:40});
  open();const ul=document.getElementById('my-menu');
  expect(ul.style.top).toBe('134px');expect(parseInt(ul.style.left)+190).toBeLessThanOrEqual(390-8);expect(parseInt(ul.style.left)).toBeGreaterThanOrEqual(8);
  expect(ul.className).toBe('mmp');   // position:fixed in the stylesheet
 });
});

