// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[],uploads=[],writes=[],removed=[],urlCalls=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1],path:a.slice(1).join('/')}),collection:(db,...p)=>({name:p[0],path:p.join('/')}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,path:c.path,cs}),
 setDoc:async(r,d,o)=>{if(globalThis.__setDocFails)throw new Error('write refused');writes.push(['set',r.path,d,o])},updateDoc:async(r,d)=>{writes.push(['update',r.path,d])},deleteDoc:async r=>{writes.push(['delete',r.path])},
 getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok,fail)=>{
  const docs=o=>ok({docs:Object.entries(o||{}).map(([id,d])=>({id,data:()=>d})),data:()=>({})});
  if(q.path==='settings/placeholders'){ok({data:()=>({})});return()=>{}}
  if(q.path==='settings/carousel'){ok({data:()=>globalThis.__setting||{}});return()=>{}}
  if(q.path==='carousel'){if(globalThis.__carFail){fail?.(new Error('no permission'));return()=>{}}docs(globalThis.__car);return()=>{}}
  if(/^users\/[^/]+\/registrations$/.test(q.path)){docs({});return()=>{}}
  if(/^events\/[^/]+\/evidence$/.test(q.path)){docs(globalThis.__evi);return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):[];ok({docs:src.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({path:p}),uploadBytes:async(r,b,o)=>{uploads.push([r.path,b,o])},getDownloadURL:async r=>{urlCalls.push(r.path);return 'https://files.test/'+r.path},deleteObject:async r=>{removed.push(r.path)}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:name=>async data=>{calls.push([name,data]);const h=globalThis.__fn?.[name];if(h)return {data:await h(data)};return {data:{}}}}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {RegistrationsProvider} from '../src/registrations';
import App from '../src/App';
const H=3600e3,ts=h=>({toDate:()=>new Date(Date.now()+h*H)});
const ev=(o={})=>({id:'e1',name:'Taupō Cup',description:'',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',district:'',waterbody:'Lake Taupō',limit:3,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(48),endsAt:ts(52),counts:{accepted:1,waitlist:0,seq:1},createdAt:ts(-5),...o});
const fb=(role,uid='u1')=>({uid,displayName:'Pat Person',email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const app=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><RegistrationsProvider><AppProvider><App/></AppProvider></RegistrationsProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
const item=(n,x={})=>[`c${n}`,{path:`carousel/c${n}.jpg`,caption:`Caption ${n}`,source:'upload',createdAt:ts(-n),createdBy:'a1',...x}];
const cars=(n,x)=>Object.fromEntries(Array.from({length:n},(_,i)=>item(i+1,typeof x==='function'?x(i+1):x)));
beforeEach(()=>{
 calls.length=0;uploads.length=0;writes.length=0;removed.length=0;urlCalls.length=0;localStorage.clear();vi.spyOn(Math,'random').mockReturnValue(.999);   // .999 keeps the order as listed
 globalThis.__events=[ev()];globalThis.__car=cars(3);globalThis.__setting={};globalThis.__carFail=false;globalThis.__setDocFails=false;globalThis.__evi={};globalThis.__fn={};
 globalThis.createImageBitmap=async()=>({width:4000,height:3000,close(){}});
 URL.createObjectURL=()=>'blob:x';URL.revokeObjectURL=()=>{};
 HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){},set fillStyle(v){},set imageSmoothingQuality(v){}});
 HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob([new Uint8Array(150*1024)],{type}))};
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.useRealTimers();delete globalThis.createImageBitmap;delete window.matchMedia});
const events=async(u=null)=>{app('/');await signIn(u);await waitFor(()=>screen.getByText('Taupō Cup'))};
const region=()=>screen.queryByRole('region',{name:'Photos from the league'});
const shownImg=()=>region()?.querySelector('img.car-fg');
describe('the carousel on the Events page',()=>{
 it('shows a photo with its caption above the filters, for visitors who are not signed in, and the events are still all there',async()=>{
  await events();await waitFor(()=>expect(shownImg()?.getAttribute('src')).toBe('https://files.test/carousel/c1.jpg'));
  expect(within(region()).getByText('Caption 1')).toBeTruthy();
  const bar=screen.getByRole('group',{name:'Fishing type'});
  expect(region().compareDocumentPosition(bar)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();   // above the filters
  expect(screen.getByText('Taupō Cup')).toBeTruthy();expect(screen.getByRole('heading',{name:'Events'})).toBeTruthy();
 });
 it('is not shown when an admin has turned it off, and its photos are not even fetched',async()=>{
  globalThis.__setting={enabled:false};await events();await act(async()=>{});
  expect(region()).toBeNull();expect(urlCalls.length).toBe(0);
 });
 it('is not shown when there are no photos, and an unreadable carousel never breaks the page',async()=>{
  globalThis.__car={};await events();await act(async()=>{});expect(region()).toBeNull();cleanup();
  globalThis.__carFail=true;await events();await act(async()=>{});expect(region()).toBeNull();expect(screen.getByText('Taupō Cup')).toBeTruthy();
 });
 it('picks at most 8 photos from a bigger collection',async()=>{
  globalThis.__car=cars(12);await events();await waitFor(()=>screen.getByText('1 / 8'));
 });
 it('picks a different random set of photos: not always the first ones',async()=>{
  globalThis.__car=cars(12);Math.random.mockReturnValue(0);   // 0 moves things to the front of the shuffle: a different pick than before
  await events();await waitFor(()=>screen.getByText('1 / 8'));await waitFor(()=>expect(shownImg()).toBeTruthy());
  expect(shownImg().getAttribute('src')).not.toBe('https://files.test/carousel/c1.jpg');
 });
 it('moves with the arrows and wraps around at both ends',async()=>{
  await events();await waitFor(()=>expect(shownImg()).toBeTruthy());
  const at=()=>shownImg()?.getAttribute('src').split('/').pop();
  fireEvent.click(screen.getByRole('button',{name:'Next photo'}));await waitFor(()=>expect(at()).toBe('c2.jpg'));
  fireEvent.click(screen.getByRole('button',{name:'Next photo'}));fireEvent.click(screen.getByRole('button',{name:'Next photo'}));await waitFor(()=>expect(at()).toBe('c1.jpg'));
  fireEvent.click(screen.getByRole('button',{name:'Previous photo'}));await waitFor(()=>expect(at()).toBe('c3.jpg'));
 });
 it('one photo needs no arrows or counter',async()=>{
  globalThis.__car=cars(1);await events();await waitFor(()=>expect(shownImg()).toBeTruthy());
  expect(screen.queryByRole('button',{name:'Next photo'})).toBeNull();expect(screen.getByRole('button',{name:'Hide photos'})).toBeTruthy();
 });
 it('moves on by itself, stops when paused or hovered, and carries on afterwards',async()=>{
  vi.useFakeTimers({toFake:['setInterval','clearInterval']});await events();for(let i=0;i<4;i++)await act(async()=>{});
  const at=()=>shownImg()?.getAttribute('src').split('/').pop(),tick=()=>act(async()=>{vi.advanceTimersByTime(6000)});
  expect(at()).toBe('c1.jpg');await tick();expect(at()).toBe('c2.jpg');
  fireEvent.mouseEnter(region());await tick();expect(at()).toBe('c2.jpg');fireEvent.mouseLeave(region());await tick();expect(at()).toBe('c3.jpg');
  fireEvent.click(screen.getByRole('button',{name:'Pause the slideshow'}));await tick();await tick();expect(at()).toBe('c3.jpg');
  fireEvent.click(screen.getByRole('button',{name:'Play the slideshow'}));await tick();expect(at()).toBe('c1.jpg');
 });
 it('does not move by itself for people who asked their device for less motion (the arrows still work)',async()=>{
  window.matchMedia=q=>({matches:/reduce/.test(q),addEventListener(){},removeEventListener(){}});
  vi.useFakeTimers({toFake:['setInterval','clearInterval']});await events();for(let i=0;i<4;i++)await act(async()=>{});
  await act(async()=>{vi.advanceTimersByTime(30000)});expect(shownImg().getAttribute('src')).toMatch(/c1\.jpg$/);
  expect(screen.getByRole('button',{name:'Play the slideshow'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Next photo'}));await act(async()=>{});expect(shownImg().getAttribute('src')).toMatch(/c2\.jpg$/);
 });
 it('can be hidden and shown again by the visitor, and remembers the choice on that device',async()=>{
  await events();await waitFor(()=>expect(shownImg()).toBeTruthy());
  const toggle=()=>screen.getByRole('button',{name:/^(Hide|Show) photos$/});
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(toggle());
  expect(shownImg()).toBeNull();expect(toggle().textContent).toBe('Show photos');expect(toggle().getAttribute('aria-expanded')).toBe('false');
  expect(screen.queryByRole('button',{name:'Next photo'})).toBeNull();expect(region()).toBeTruthy();   // a slim bar stays so it can be opened again
  expect(localStorage.getItem('fl.carousel.collapsed')).toBe('1');
  cleanup();urlCalls.length=0;await events();await act(async()=>{});   // next visit: still hidden, and no picture is downloaded
  expect(toggle().textContent).toBe('Show photos');expect(shownImg()).toBeNull();expect(urlCalls.length).toBe(0);
  fireEvent.click(toggle());await waitFor(()=>expect(shownImg()).toBeTruthy());expect(localStorage.getItem('fl.carousel.collapsed')).toBeNull();
 });
 it('still works when the browser will not let the page remember anything',async()=>{
  vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')});
  await events();await waitFor(()=>expect(shownImg()).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Hide photos'}));expect(shownImg()).toBeNull();
 });
 it('a caption of an event opens that event; a caption without an event is plain text',async()=>{
  globalThis.__car={...Object.fromEntries([item(1,{eventId:'e1',caption:'Taupō Cup · Snapper',source:'evidence'})]),...Object.fromEntries([item(2,{eventId:'gone',caption:'Old event'})])};
  await events();await waitFor(()=>expect(shownImg()).toBeTruthy());
  const link=within(region()).getByRole('link',{name:'Taupō Cup · Snapper'});expect(link.getAttribute('href')).toBe('/event/e1');
  fireEvent.click(screen.getByRole('button',{name:'Next photo'}));await waitFor(()=>screen.getByText('Old event'));expect(within(region()).queryByRole('link')).toBeNull();
 });
 it('gives the picture a text description for screen readers',async()=>{
  globalThis.__car=cars(1,{caption:''});await events();await waitFor(()=>expect(shownImg()).toBeTruthy());
  expect(shownImg().getAttribute('alt')).toBe('Photo from the league');cleanup();
  globalThis.__car=cars(1);await events();await waitFor(()=>expect(shownImg()).toBeTruthy());expect(shownImg().getAttribute('alt')).toBe('');   // the caption beside it is read instead
 });
});
describe('Admin > Carousel',()=>{
 const admin=async(role='admin')=>{app('/admin');await signIn(fb(role,'a1'));await waitFor(()=>screen.getByRole('button',{name:'Carousel'}));fireEvent.click(screen.getByRole('button',{name:'Carousel'}));await waitFor(()=>screen.getByText(/Photos in the carousel/))};
 const choose=async f=>{await act(async()=>{fireEvent.change(screen.getByLabelText('Photo to add'),{target:{files:[f]}})})};
 const jpg=()=>new File([new Uint8Array(2000)],'p.jpg',{type:'image/jpeg'});
 it('is a tab for admins and superadmins',async()=>{await admin();expect(screen.getByText('Photos in the carousel (3 of 30)')).toBeTruthy();cleanup();await admin('superadmin')});
 it('is not offered to an organiser',async()=>{app('/admin');await signIn(fb('organiser','o1'));await act(async()=>{});expect(screen.queryByRole('button',{name:'Carousel'})).toBeNull();expect(screen.queryByRole('switch')).toBeNull()});
 it('turns the carousel off and on with one switch',async()=>{
  await admin();const sw=screen.getByRole('switch');expect(sw.checked).toBe(true);expect(screen.getByText(/The carousel is on/)).toBeTruthy();
  fireEvent.click(sw);await waitFor(()=>expect(writes.at(-1)).toEqual(['set','settings/carousel',{enabled:false,updatedAt:'TS'},{merge:true}]));
  cleanup();globalThis.__setting={enabled:false};await admin();expect(screen.getByRole('switch').checked).toBe(false);expect(screen.getByText(/The carousel is off/)).toBeTruthy();
  fireEvent.click(screen.getByRole('switch'));await waitFor(()=>expect(writes.at(-1)[2].enabled).toBe(true));
 });
 it('shows the message when the switch cannot be saved',async()=>{
  await admin();globalThis.__setDocFails=true;fireEvent.click(screen.getByRole('switch'));await waitFor(()=>screen.getByText('write refused'));
 });
 it('uploads a photo: a small JPEG goes to carousel/, then its record is made',async()=>{
  await admin();fireEvent.change(screen.getByLabelText('Caption (optional)'),{target:{value:'  Opening day  '}});await choose(jpg());
  await waitFor(()=>screen.getByText('Photo added.'));
  expect(uploads.length).toBe(1);const [path,blob,opts]=uploads[0];expect(path).toMatch(/^carousel\/[0-9a-f]{20}\.jpg$/);expect(opts).toEqual({contentType:'image/jpeg'});expect(blob.size).toBeLessThan(2*1024*1024);
  const id=path.slice(9,-4);expect(writes.at(-1)).toEqual(['set','carousel/'+id,{path,caption:'Opening day',source:'upload',createdAt:'TS',createdBy:'a1'},undefined]);
  expect(screen.getByLabelText('Caption (optional)').value).toBe('');
 });
 it('refuses something that is not a picture, and a full carousel, without uploading',async()=>{
  await admin();await choose(new File(['hi'],'a.txt',{type:'text/plain'}));await waitFor(()=>screen.getByText('Use a JPEG, PNG or WebP image.'));expect(uploads.length).toBe(0);cleanup();
  globalThis.__car=cars(30);await admin();await choose(jpg());await waitFor(()=>screen.getByText('The carousel holds up to 30 photos. Remove one first.'));expect(uploads.length).toBe(0);
 });
 it('takes the uploaded file back if its record cannot be saved',async()=>{
  await admin();globalThis.__setDocFails=true;await choose(jpg());await waitFor(()=>screen.getByText('write refused'));
  expect(uploads.length).toBe(1);expect(removed).toEqual([uploads[0][0]]);
 });
 it('lists the photos with their source and lets an admin change a caption',async()=>{
  globalThis.__car={...Object.fromEntries([item(1,{source:'evidence',eventId:'e1',evidenceId:'x'})]),...Object.fromEntries([item(2)])};
  await admin();expect(screen.getByText('From an approved evidence photo')).toBeTruthy();expect(screen.getByText('Uploaded by an admin')).toBeTruthy();
  const box=screen.getAllByLabelText('Caption').find(i=>i.value==='Caption 2');const save=box.closest('.li').querySelector('button.o');expect(save.disabled).toBe(true);
  fireEvent.change(box,{target:{value:'  New words '}});expect(save.disabled).toBe(false);fireEvent.click(save);
  await waitFor(()=>expect(writes.at(-1)).toEqual(['update','carousel/c2',{caption:'New words'}]));
 });
 it('removes a photo after confirming: the record and the file',async()=>{
  await admin();const rows=()=>screen.getAllByRole('button',{name:'Remove'});
  vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(rows()[0]);await act(async()=>{});expect(writes.length).toBe(0);expect(removed.length).toBe(0);
  window.confirm.mockReturnValue(true);fireEvent.click(rows()[0]);await waitFor(()=>expect(removed.length).toBe(1));
  expect(writes).toEqual([['delete','carousel/c1']]);expect(removed).toEqual(['carousel/c1.jpg']);
 });
 it('adds an approved evidence photo through the function; pending and rejected ones are not offered',async()=>{
  globalThis.__evi={x1:{userId:'u2',userName:'Alice',species:'Snapper',status:'Approved',weight:2.3,photoPath:'evidence/e1/u2/x1.jpg',createdAt:ts(-1)},x2:{userId:'u3',userName:'Bob',species:'Trout',status:'Pending',photoPath:'evidence/e1/u3/x2.jpg',createdAt:ts(-2)},x3:{userId:'u4',userName:'Cy',species:'Perch',status:'Rejected',photoPath:'evidence/e1/u4/x3.jpg',createdAt:ts(-3)}};
  globalThis.__fn={featureEvidencePhoto:async()=>({id:'ev_x1'})};
  await admin();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});await waitFor(()=>screen.getByText('Snapper'));
  expect(screen.queryByText('Trout')).toBeNull();expect(screen.queryByText('Perch')).toBeNull();expect(screen.queryByText(/Alice|Bob/)).toBeNull();   // no names
  fireEvent.click(screen.getByRole('button',{name:'Add to carousel'}));await waitFor(()=>screen.getByText('Added to the carousel.'));
  expect(calls.filter(c=>c[0]==='featureEvidencePhoto')).toEqual([['featureEvidencePhoto',{eventId:'e1',evidenceId:'x1'}]]);
 });
 it('shows the function\'s message when it refuses, and does not offer a photo that is already in the carousel',async()=>{
  globalThis.__evi={x1:{species:'Snapper',status:'Approved',photoPath:'evidence/e1/u2/x1.jpg',createdAt:ts(-1)},x9:{species:'Eel',status:'Approved',photoPath:'evidence/e1/u2/x9.jpg',createdAt:ts(-2)}};
  globalThis.__car={...cars(2),...Object.fromEntries([item(3,{eventId:'e1',evidenceId:'x9',source:'evidence'})])};
  globalThis.__fn={featureEvidencePhoto:async()=>{throw new Error('Only approved photos can be added to the carousel.')}};
  await admin();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});await waitFor(()=>screen.getByText('Snapper'));
  expect(screen.getByRole('button',{name:'In the carousel'}).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Add to carousel'}));await waitFor(()=>screen.getByText('Only approved photos can be added to the carousel.'));
 });
 it('cannot add more evidence photos when the carousel is full',async()=>{
  globalThis.__evi={x1:{species:'Snapper',status:'Approved',photoPath:'evidence/e1/u2/x1.jpg',createdAt:ts(-1)}};globalThis.__car=cars(30);
  await admin();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});await waitFor(()=>screen.getByText('Snapper'));
  expect(screen.getByRole('button',{name:'Add to carousel'}).disabled).toBe(true);expect(calls.filter(c=>c[0]==='featureEvidencePhoto').length).toBe(0);
 });
 it('says so when an event has no approved photos yet',async()=>{
  await admin();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});await waitFor(()=>screen.getByText('No approved photos for this event yet.'));
 });
});
