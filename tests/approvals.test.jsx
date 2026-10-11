// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[2]||'new1'}),collection:(db,name)=>({name}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,cs}),
 setDoc:async(r,d)=>{calls.push(['setDoc',r.id,d])},updateDoc:async(r,d)=>{calls.push(['updateDoc',r.id,d])},
 getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok)=>{
  const src=q.name==='events'?(globalThis.__events||[]):(globalThis.__clubs||[]),c=q.cs?.[0];
  const list=!c?src:c.f==='status'?src.filter(e=>c.op==='in'?c.v.includes(e.status):e.status===c.v):c.f==='ownerId'?src.filter(e=>e.ownerId===c.v):[];
  ok({docs:list.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({p}),uploadBytes:async()=>{},getDownloadURL:async()=>'https://img.example/x.webp',deleteObject:async()=>{}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import App from '../src/App';
const ts=days=>({toDate:()=>new Date(Date.now()+days*864e5)});
const club=o=>({name:'Club',region:'Otago',town:'Dunedin',waterTypes:['Sea'],disciplines:[],coverUrl:'',ownerId:'o1',ownerName:'Olivia Organiser',createdAt:ts(-2),...o});
const event=o=>({description:'',waterType:'Sea',discipline:'Spin',format:'Individual',region:'Otago',district:'',waterbody:'Otago Harbour',limit:10,fee:0,coverUrl:'',ownerId:'o1',ownerName:'Olivia Organiser',startsAt:ts(30),createdAt:ts(-1),...o});
const fb=(role,uid)=>({uid,displayName:role+' '+uid,email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const mount=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><AppProvider><App/></AppProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
beforeEach(()=>{calls.length=0;
 globalThis.__clubs=[club({id:'c1',name:'Pending Club',status:'pending'}),club({id:'c2',name:'Live Club',status:'approved'}),club({id:'c3',name:'Old Club'}),club({id:'c4',name:'Rejected Club',status:'rejected',rejectionReason:'Please add a description'})];
 globalThis.__events=[event({id:'e1',name:'Pending Event',status:'pending'}),event({id:'e2',name:'Live Event',status:'published'}),event({id:'e3',name:'Draft Event',status:'draft'})]});
afterEach(cleanup);
const row=name=>within(screen.getByText(name).closest('.li'));
const saveBtn=()=>screen.getByRole('button',{name:/Save event|Submit for approval/});
describe('what people can see',()=>{
 it('the public sees only approved clubs and published events',async()=>{
  mount('/clubs');await signIn(null);await waitFor(()=>screen.getByText('Live Club'));
  ['Pending Club','Old Club','Rejected Club'].forEach(n=>expect(screen.queryByText(n)).toBeNull());cleanup();
  mount('/');await signIn(null);await waitFor(()=>screen.getByText('Live Event'));
  ['Pending Event','Draft Event'].forEach(n=>expect(screen.queryByText(n)).toBeNull());
 });
 it('owners see their own pending and rejected clubs, without a Join button; other organisers do not',async()=>{
  mount('/clubs');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Pending Club'));
  expect(screen.getByText('Pending approval')).toBeTruthy();expect(screen.getByText('Not approved')).toBeTruthy();
  expect(screen.getAllByText('Join').length).toBeGreaterThan(0);expect(screen.getAllByText('Join').length).toBeLessThan(4);cleanup();
  mount('/clubs');await signIn(fb('organiser','o2'));await waitFor(()=>screen.getByText('Live Club'));expect(screen.queryByText('Pending Club')).toBeNull();
 });
 it('a pending event shows the owner a banner and cannot be registered for',async()=>{
  mount('/event/e1');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText(/Waiting for approval/));
  expect(screen.getByText('Awaiting approval',{selector:'button'}).disabled).toBe(true);
 });
});
describe('Approvals tab',()=>{
 const open=async(role='admin')=>{mount('/admin');await signIn(fb(role,'a1'));await waitFor(()=>screen.getByText('Approvals (2)'));fireEvent.click(screen.getByText('Approvals (2)'))};
 it('is for admins only',async()=>{
  mount('/admin');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByRole('heading',{name:'Events'}));expect(screen.queryByText(/Approvals/)).toBeNull();
 });
 it('lists what is waiting and approves a club and an event',async()=>{
  await open();await waitFor(()=>screen.getByText('Pending Club'));expect(screen.getByText('Pending Event')).toBeTruthy();expect(screen.queryByText('Live Club')).toBeNull();
  fireEvent.click(row('Pending Club').getByText('Approve'));await waitFor(()=>expect(calls.length).toBe(1));
  expect(calls[0]).toEqual(['updateDoc','c1',{status:'approved',rejectionReason:'',reviewedBy:'a1',reviewedByName:'admin a1',reviewedAt:'TS'}]);
  fireEvent.click(row('Pending Event').getByText('Approve'));await waitFor(()=>expect(calls.length).toBe(2));
  expect(calls[1][2]).toMatchObject({status:'published',rejectionReason:'',reviewedBy:'a1'});
 });
 it('rejecting needs a reason, which is saved for the organiser',async()=>{
  await open();await waitFor(()=>screen.getByText('Pending Event'));
  fireEvent.click(row('Pending Event').getByText('Reject…'));fireEvent.click(screen.getByText('Confirm reject'));
  expect(screen.getByRole('alert').textContent).toMatch(/short reason/);expect(calls.length).toBe(0);
  fireEvent.change(screen.getByLabelText('Reason for Pending Event'),{target:{value:'Dates are wrong'}});fireEvent.click(screen.getByText('Confirm reject'));
  await waitFor(()=>expect(calls.length).toBe(1));expect(calls[0]).toEqual(['updateDoc','e1',{status:'rejected',rejectionReason:'Dates are wrong',reviewedBy:'a1',reviewedByName:'admin a1',reviewedAt:'TS'}]);
 });
 it('can revoke something already approved, and shows the older clubs that need a status',async()=>{
  await open();fireEvent.click(screen.getByText('Approved'));await waitFor(()=>screen.getByText('Live Event'));
  expect(screen.getByText(/1 club created before approvals existed/)).toBeTruthy();
  fireEvent.click(row('Live Event').getByText('Revoke'));fireEvent.change(screen.getByLabelText('Reason for Live Event'),{target:{value:'Not allowed'}});fireEvent.click(screen.getByText('Confirm revoke'));
  await waitFor(()=>expect(calls.length).toBe(1));expect(calls[0][1]).toBe('e2');expect(calls[0][2]).toMatchObject({status:'rejected',rejectionReason:'Not allowed'});
  fireEvent.click(screen.getByText('Approve all'));await waitFor(()=>expect(calls.length).toBe(2));expect(calls[1]).toEqual(['updateDoc','c3',expect.objectContaining({status:'approved'})]);
 });
});
describe('submitting for approval',()=>{
 const fillClub=()=>{fireEvent.change(screen.getByLabelText(/Club name/),{target:{value:'New Club'}});fireEvent.click(screen.getByLabelText(/Sea fishing/));fireEvent.change(screen.getByLabelText(/Region/),{target:{value:'Otago'}})};
 it('a new club from an organiser is pending; from an admin it is approved',async()=>{
  mount('/clubs/new');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Save club'));expect(screen.getByText(/checked by an admin/)).toBeTruthy();
  fillClub();fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].status).toBe('pending');cleanup();calls.length=0;
  mount('/clubs/new');await signIn(fb('admin','a1'));await waitFor(()=>screen.getByText('Save club'));expect(screen.queryByText(/checked by an admin/)).toBeNull();
  fillClub();fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0][2].status).toBe('approved');
 });
 it('saving a rejected club sends it back for approval and shows the reason',async()=>{
  mount('/clubs/c4/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText(/Please add a description/));
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect(calls[0].slice(0,2)).toEqual(['updateDoc','c4']);expect(calls[0][2].status).toBe('pending');
 });
 it('an owner editing an approved club does not touch its status',async()=>{
  globalThis.__clubs=[club({id:'c2',name:'Live Club',status:'approved'})];
  mount('/clubs/c2/edit');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Save club'));
  fireEvent.click(screen.getByText('Save club'));await waitFor(()=>expect(calls.length).toBeGreaterThan(0));expect('status' in calls[0][2]).toBe(false);
 });
 it('event status choices depend on who you are and where the event is in the process',async()=>{
  const opts=()=>[...screen.getByLabelText(/^Status/).querySelectorAll('option')].map(o=>o.textContent);
  mount('/event/new');await signIn(fb('organiser','o1'));await waitFor(()=>saveBtn());
  expect(opts()).toEqual(['Submit for approval','Save as draft (only you and admins)']);expect(saveBtn().textContent).toBe('Submit for approval');cleanup();
  mount('/event/new');await signIn(fb('admin','a1'));await waitFor(()=>saveBtn());expect(opts()).toContain('Published (public)');expect(saveBtn().textContent).toBe('Save event');cleanup();
  mount('/event/e2/edit');await signIn(fb('organiser','o1'));await waitFor(()=>saveBtn());expect(opts()).toEqual(['Published (public)','Cancelled']);cleanup();
  mount('/event/e1/edit');await signIn(fb('organiser','o1'));await waitFor(()=>saveBtn());expect(opts()).toEqual(['Submit for approval','Save as draft (only you and admins)']);
 });
});
