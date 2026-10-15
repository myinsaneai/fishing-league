// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1],path:a.slice(1).join('/')}),collection:(db,...p)=>({name:p[0],path:p.join('/')}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,path:c.path,cs}),
 setDoc:vi.fn(),updateDoc:vi.fn(),getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  const docs=o=>ok({docs:Object.entries(o||{}).map(([id,d])=>({id,data:()=>d})),data:()=>({})});
  if(q.path==='settings/placeholders'){ok({data:()=>({})});return()=>{}}
  if(/^users\/[^/]+\/registrations$/.test(q.path)){docs(globalThis.__mine);return()=>{}}
  if(/^events\/[^/]+\/registrations$/.test(q.path)){docs(globalThis.__pub);return()=>{}}
  if(/^events\/[^/]+\/registrationPrivate$/.test(q.path)){docs(globalThis.__priv);return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):(q.name==='clubs'?(globalThis.__clubs||[]):[]),c=q.cs?.[0];
  const list=!c?src:c.f==='status'?src.filter(e=>c.op==='in'?c.v.includes(e.status):e.status===c.v):c.f==='ownerId'?src.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:vi.fn(),uploadBytes:vi.fn(),getDownloadURL:vi.fn(),deleteObject:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:name=>async data=>{calls.push([name,data]);const h=globalThis.__fn?.[name];if(h)return {data:await h(data)};return {data:{}}}}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {RegistrationsProvider} from '../src/registrations';
import App from '../src/App';
const H=3600e3,ts=h=>({toDate:()=>new Date(Date.now()+h*H)});
const ev=o=>({id:'e1',name:'Taupō Cup',description:'',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',district:'',waterbody:'Lake Taupō',limit:3,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(72),endsAt:ts(76),counts:{accepted:1,waitlist:0,seq:1},...o});
const fb=(role,uid='u1')=>({uid,displayName:'Pat Person',email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const app=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><RegistrationsProvider><AppProvider><App/></AppProvider></RegistrationsProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const fill=(l,v)=>fireEvent.change(screen.getByLabelText(l),{target:{value:v}});
const mineDoc=(status,o={})=>({'e1':{status,order:1,confirmed:false,createdAt:ts(-5),...o}});
beforeEach(()=>{calls.length=0;globalThis.__events=[ev({})];globalThis.__clubs=[{id:'c1',name:'Taupō Anglers',status:'approved',ownerId:'o9'}];globalThis.__mine={};globalThis.__pub={};globalThis.__priv={};globalThis.__fn={}});
afterEach(cleanup);
const open=async(role='participant',uid='u1')=>{app('/event/e1');await signIn(fb(role,uid));await waitFor(()=>screen.getByText('Registration closes'))};
describe('registering',()=>{
 it('asks a signed-out visitor to sign in first',async()=>{
  app('/event/e1');await signIn(null);await waitFor(()=>screen.getByText('Sign in to register'));fireEvent.click(screen.getByText('Sign in to register'));expect(screen.getByRole('dialog')).toBeTruthy();
 });
 it('sends the form to the server and confirms',async()=>{
  globalThis.__fn.registerForEvent=async()=>({status:'Accepted',order:2,waitlistPosition:0});
  await open();fireEvent.click(screen.getByText('Register'));expect(screen.getByLabelText('Full name').value).toBe('Pat Person');expect(screen.queryByLabelText('Team name')).toBeNull();
  fill('Full name','Patricia Person');fill('Phone','021 555 1234');fill('Club','c1');fireEvent.click(screen.getByLabelText(/I accept the event rules/));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Register',{selector:'button'}));
  await waitFor(()=>screen.getByText(/You're registered/));
  expect(calls).toEqual([['registerForEvent',{eventId:'e1',name:'Patricia Person',phone:'021 555 1234',clubId:'c1',teamName:'',acceptRules:true}]]);expect(screen.queryByRole('dialog')).toBeNull();
 });
 it('offers the waitlist when the event is full, and says where the person is',async()=>{
  globalThis.__events=[ev({counts:{accepted:3,waitlist:2,seq:5}})];globalThis.__fn.registerForEvent=async()=>({status:'Waitlist',order:6,waitlistPosition:3});
  await open();expect(screen.getByText('2 on the waitlist')).toBeTruthy();fireEvent.click(screen.getByText('Join waitlist'));expect(screen.getByText(/This event is full/)).toBeTruthy();
  fill('Phone','021 555 1234');fireEvent.click(screen.getByLabelText(/I accept the event rules/));fireEvent.click(within(screen.getByRole('dialog')).getByText('Join waitlist',{selector:'button'}));
  await waitFor(()=>screen.getByText(/on the waitlist \(position 3\)/));
 });
 it('asks for a team name on team events',async()=>{
  globalThis.__events=[ev({format:'Team'})];globalThis.__fn.registerForEvent=async()=>({status:'Accepted',order:2,waitlistPosition:0});
  await open();fireEvent.click(screen.getByText('Register'));fill('Phone','021 555 1234');fill('Team name','The Reelers');fireEvent.click(screen.getByLabelText(/I accept the event rules/));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Register',{selector:'button'}));await waitFor(()=>expect(calls.length).toBe(1));expect(calls[0][1].teamName).toBe('The Reelers');
 });
 it("shows the server's reason when it refuses, and keeps the form open",async()=>{
  globalThis.__fn.registerForEvent=async()=>{throw new Error('Registration for this event has closed.')};
  await open();fireEvent.click(screen.getByText('Register'));fill('Phone','021 555 1234');fireEvent.click(screen.getByLabelText(/I accept the event rules/));
  fireEvent.click(within(screen.getByRole('dialog')).getByText('Register',{selector:'button'}));await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/has closed/);expect(screen.getByRole('dialog')).toBeTruthy();
 });
});
describe('my registration on the event page',()=>{
 it('shows the status and lets the person cancel, after a confirmation step',async()=>{
  globalThis.__mine=mineDoc('Accepted');globalThis.__fn.cancelRegistration=async()=>({status:'Cancelled'});
  await open();expect(screen.getByText('You: Accepted')).toBeTruthy();expect(screen.queryByText('Register')).toBeNull();
  fireEvent.click(screen.getByText('Cancel registration'));fireEvent.click(screen.getByText('Keep my place'));expect(calls.length).toBe(0);
  fireEvent.click(screen.getByText('Cancel registration'));fireEvent.click(screen.getByText('Yes, cancel'));await waitFor(()=>screen.getByText('Your registration has been cancelled.'));expect(calls).toEqual([['cancelRegistration',{eventId:'e1'}]]);
 });
 it('shows a waitlisted person as waitlisted',async()=>{globalThis.__mine=mineDoc('Waitlist');await open();expect(screen.getByText('You: Waitlist')).toBeTruthy()});
 it('no cancel button once the event has started, or once checked in',async()=>{
  globalThis.__events=[ev({startsAt:ts(-1),endsAt:ts(3),registrationCloses:'end'})];globalThis.__mine=mineDoc('Accepted');await open();expect(screen.getByText('You: Accepted')).toBeTruthy();expect(screen.queryByText('Cancel registration')).toBeNull();cleanup();
  globalThis.__events=[ev({})];globalThis.__mine=mineDoc('On site');await open();expect(screen.getByText('You: On site')).toBeTruthy();expect(screen.queryByText('Cancel registration')).toBeNull();
 });
 it('someone the organiser declined cannot register again, but someone who cancelled can',async()=>{
  globalThis.__mine=mineDoc('Declined');await open();expect(screen.getByText('Your registration was not accepted')).toBeTruthy();expect(screen.queryByText('Register')).toBeNull();cleanup();
  globalThis.__mine=mineDoc('Cancelled');await open();expect(screen.getByText('Register')).toBeTruthy();
 });
});
describe('participants tab',()=>{
 it('lists names, teams and clubs, the waitlist in order, and no contact details',async()=>{
  globalThis.__pub={a:{name:'Alice',status:'Accepted',order:1},b:{name:'Bob',status:'On site',order:2,teamName:'The Reelers',clubId:'c1'},c:{name:'Cara',status:'Waitlist',order:4},d:{name:'Dan',status:'Waitlist',order:3},e:{name:'Eve',status:'Cancelled',order:5},f:{name:'Fay',status:'Declined',order:6}};
  globalThis.__priv={a:{phone:'021 999 0000',email:'alice@x.com'}};
  await open();fireEvent.click(screen.getByText('Participants'));await waitFor(()=>screen.getByText('Alice'));
  expect(screen.getByText(/Team The Reelers/)).toBeTruthy();expect(screen.getByText(/Taupō Anglers/)).toBeTruthy();
  const names=[...document.querySelectorAll('.li .g')].map(x=>x.textContent);expect(names[0]).toBe('Alice');expect(names.findIndex(n=>n.startsWith('Dan'))).toBeLessThan(names.findIndex(n=>n.startsWith('Cara')));
  ['Eve','Fay'].forEach(n=>expect(screen.queryByText(n)).toBeNull());expect(document.body.textContent).not.toMatch(/021 999 0000|alice@x\.com/);expect(screen.getByText(/Names only/)).toBeTruthy();
 });
 it('says so when nobody has registered',async()=>{await open();fireEvent.click(screen.getByText('Participants'));await waitFor(()=>screen.getByText('Nobody has registered yet.'))});
});
describe('My page',()=>{
 const page=async()=>{app('/me');await signIn(fb('participant','u1'));await waitFor(()=>screen.getByText('Upcoming'))};
 it('lists registrations with their status; cancelled ones are hidden',async()=>{
  globalThis.__events=[ev({startsAt:ts(100),endsAt:ts(104)}),ev({id:'e2',name:'Harbour Cup'}),ev({id:'e3',name:'Old Cup'})];
  globalThis.__mine={...mineDoc('Accepted'),e2:{status:'Waitlist',order:3},e3:{status:'Cancelled',order:1}};
  await page();expect(screen.getByText('Taupō Cup',{selector:'b'})).toBeTruthy();expect(screen.getByText('Harbour Cup',{selector:'b'})).toBeTruthy();expect(screen.queryByText('Old Cup')).toBeNull();
  expect(screen.getByText('Waitlist',{selector:'.t'})).toBeTruthy();expect(screen.getAllByText('Cancel registration')).toHaveLength(2);
 });
 it('asks for confirmation within 3 days of the start',async()=>{
  globalThis.__events=[ev({startsAt:ts(30),endsAt:ts(34)})];globalThis.__mine=mineDoc('Accepted');globalThis.__fn.confirmAttendance=async()=>({confirmed:true});globalThis.__fn.cancelRegistration=async()=>({status:'Cancelled'});
  await page();fireEvent.click(screen.getByText("I'm coming"));await waitFor(()=>expect(calls).toEqual([['confirmAttendance',{eventId:'e1'}]]));calls.length=0;
  fireEvent.click(screen.getByText("Can't come"));await waitFor(()=>expect(calls).toEqual([['cancelRegistration',{eventId:'e1'}]]));
 });
 it('shows Confirmed once confirmed, and the error when the server says no',async()=>{
  globalThis.__events=[ev({startsAt:ts(30),endsAt:ts(34)})];globalThis.__mine=mineDoc('Accepted',{confirmed:true});await page();expect(screen.getByText('Confirmed')).toBeTruthy();expect(screen.queryByText("I'm coming")).toBeNull();cleanup();
  globalThis.__mine=mineDoc('Waitlist');globalThis.__fn.cancelRegistration=async()=>{throw new Error('The event has already started.')};await page();fireEvent.click(screen.getByText(/Cancel registration|Can't come/));await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/already started/);
 });
 it('counts attended events in the reliability line',async()=>{
  const past=(id,name)=>ev({id,name,startsAt:ts(-100),endsAt:ts(-96)});
  globalThis.__events=[past('p1','Past One'),past('p2','Past Two'),past('p3','Past Three'),ev({})];
  globalThis.__mine={p1:{status:'On site'},p2:{status:'Accepted'},p3:{status:'Waitlist'},...mineDoc('Accepted')};
  await page();expect(screen.getByText('Attended 1 of 2 registered events')).toBeTruthy();expect(screen.getByText('Past One',{selector:'.g'})).toBeTruthy();
 });
 it('only offers evidence for events the person is taking part in',async()=>{
  globalThis.__events=[ev({}),ev({id:'e2',name:'Harbour Cup'})];globalThis.__mine={...mineDoc('Accepted'),e2:{status:'Waitlist'}};await page();
  const opts=[...screen.getByLabelText('Event').querySelectorAll('option')].map(o=>o.textContent);expect(opts).toEqual(['Event…','Taupō Cup']);
 });
});
describe('organiser table',()=>{
 const people=()=>{globalThis.__pub={a:{name:'Alice',status:'Accepted',order:1,createdAt:ts(-48),teamName:'',clubId:'c1'},b:{name:'Bob',status:'Waitlist',order:2,createdAt:ts(-24)},c:{name:'Cara',status:'Cancelled',order:3},d:{name:'Dan',status:'Declined',order:4}};
  globalThis.__priv={a:{phone:'021 111 1111',email:'alice@x.com'},b:{phone:'021 222 2222',email:'bob@x.com'}}};
 const manage=async(role='organiser',uid='o1')=>{people();app('/manage');await signIn(fb(role,uid));await waitFor(()=>screen.getByText('Alice'))};
 it('shows the spots, the contacts, and hides closed registrations by default',async()=>{
  await manage();expect(screen.getByRole('status').textContent).toMatch(/1.*of 3 spots filled.*0.*on the waitlist/);
  expect(screen.getByText('021 111 1111')).toBeTruthy();expect(screen.getByText('bob@x.com')).toBeTruthy();expect(screen.getByText(/Taupō Anglers/)).toBeTruthy();
  expect(screen.queryByText('Cara')).toBeNull();expect(screen.queryByText('Dan')).toBeNull();
  fireEvent.change(screen.getByLabelText('Show'),{target:{value:'closed'}});expect(screen.getByText('Cara')).toBeTruthy();expect(screen.getByText('Dan')).toBeTruthy();expect(screen.queryByText('Alice')).toBeNull();
  fireEvent.change(screen.getByLabelText('Show'),{target:{value:'all'}});expect(screen.getByText('Alice')).toBeTruthy();expect(screen.getByText('Cara')).toBeTruthy();
 });
 it('changes a status through the server',async()=>{
  globalThis.__fn.setRegistrationStatus=async()=>({status:'On site'});
  await manage();fireEvent.change(screen.getByLabelText('Status for Alice'),{target:{value:'On site'}});await waitFor(()=>expect(calls).toEqual([['setRegistrationStatus',{eventId:'e1',uid:'a',status:'On site'}]]));
 });
 it("shows the server's reason when it refuses a change",async()=>{
  globalThis.__fn.setRegistrationStatus=async()=>{throw new Error('No spots left. Raise the limit or move someone off the list first.')};
  await manage();fireEvent.change(screen.getByLabelText('Status for Bob'),{target:{value:'Accepted'}});await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/No spots left/);
 });
 it('a cancelled person is shown as cancelled and cannot be changed',async()=>{
  await manage();fireEvent.change(screen.getByLabelText('Show'),{target:{value:'closed'}});expect(screen.getByText('Cancelled',{selector:'.t'})).toBeTruthy();expect(screen.queryByLabelText('Status for Cara')).toBeNull();expect(screen.getByLabelText('Status for Dan').value).toBe('Declined');
 });
 it('an admin can manage any event; a participant cannot open the page',async()=>{
  await manage('admin','a1');expect(screen.getByLabelText('Status for Alice')).toBeTruthy();cleanup();
  app('/manage');await signIn(fb('participant','u9'));await waitFor(()=>screen.getByRole('heading',{name:'Events'}));
 });
});
describe('spots on the catalog',()=>{
 it('come from the counts kept by the server',async()=>{
  globalThis.__events=[ev({counts:{accepted:3,waitlist:1,seq:4}}),ev({id:'e2',name:'Quiet Cup',counts:undefined})];
  app('/');await signIn(null);await waitFor(()=>screen.getByText('Taupō Cup'));
  expect(screen.getByText('3 of 3 spots filled')).toBeTruthy();expect(screen.getByText('0 of 3 spots filled')).toBeTruthy();expect(screen.getByText('Waitlist',{selector:'.t'})).toBeTruthy();
 });
});
