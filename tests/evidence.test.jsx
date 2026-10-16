// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const calls=[],uploads=[];
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
  if(/^events\/[^/]+\/evidence$/.test(q.path)){docs(globalThis.__evi);return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):[];ok({docs:src.map(e=>({id:e.id,data:()=>e}))});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({path:p}),uploadBytes:async(r,b,o)=>{uploads.push([r.path,b,o])},getDownloadURL:async r=>'https://files.test/'+r.path,deleteObject:vi.fn()}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:name=>async data=>{calls.push([name,data]);const h=globalThis.__fn?.[name];if(h)return {data:await h(data)};return {data:{}}}}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {RegistrationsProvider} from '../src/registrations';
import App from '../src/App';
const H=3600e3,ts=h=>({toDate:()=>new Date(Date.now()+h*H)});
const ev=(o={})=>({id:'e1',name:'Taupō Cup',description:'',waterType:'Freshwater',discipline:'Fly',format:'Individual',region:'Waikato',district:'',waterbody:'Lake Taupō',limit:3,fee:0,status:'published',coverUrl:'',ownerId:'o1',ownerName:'Olivia',startsAt:ts(-2),endsAt:ts(2),counts:{accepted:1,waitlist:0,seq:1},...o});
const fb=(role,uid='u1')=>({uid,displayName:'Pat Person',email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const app=path=>render(<MemoryRouter initialEntries={[path]}><AuthProvider><ClubsProvider><EventsProvider><RegistrationsProvider><AppProvider><App/></AppProvider></RegistrationsProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
// A JPEG with a small GPS block (south 41°17'12", east 174°46'35", 12.5 m), so the page reads a real position.
function jpegWithGps(){
 const gpsAt=26,n=6,dataAt=gpsAt+2+12*n+4,buf=new ArrayBuffer(dataAt+80),v=new DataView(buf);let data=dataAt,e=gpsAt+2;
 v.setUint16(0,0x4d4d);v.setUint16(2,42);v.setUint32(4,8);v.setUint16(8,1);v.setUint16(10,0x8825);v.setUint16(12,4);v.setUint32(14,1);v.setUint32(18,gpsAt);v.setUint16(gpsAt,n);
 const ascii=(t,c)=>{v.setUint16(e,t);v.setUint16(e+2,2);v.setUint32(e+4,2);v.setUint8(e+8,c.charCodeAt(0));e+=12};
 const rats=(t,l)=>{v.setUint16(e,t);v.setUint16(e+2,5);v.setUint32(e+4,l.length);v.setUint32(e+8,data);l.forEach(x=>{v.setUint32(data,x);v.setUint32(data+4,1);data+=8});e+=12};
 ascii(1,'S');rats(2,[41,17,12]);ascii(3,'E');rats(4,[174,46,35]);v.setUint16(e,5);v.setUint16(e+2,1);v.setUint32(e+4,1);v.setUint8(e+8,0);e+=12;rats(6,[12]);
 const tiff=new Uint8Array(buf,0,data),exif=new Uint8Array(6+tiff.length);exif.set([0x45,0x78,0x69,0x66,0,0]);exif.set(tiff,6);
 const out=new Uint8Array(2+4+exif.length+6);out.set([0xff,0xd8,0xff,0xe1]);new DataView(out.buffer).setUint16(4,exif.length+2);out.set(exif,6);out.set([0xff,0xda,0,2,0,0],6+exif.length);
 return new File([out],'catch.jpg',{type:'image/jpeg'});
}
const plain=()=>new File([new Uint8Array(2000)],'plain.jpg',{type:'image/jpeg'});
beforeEach(()=>{
 calls.length=0;uploads.length=0;globalThis.__events=[ev()];globalThis.__mine={e1:{status:'Accepted',order:1,confirmed:false,createdAt:ts(-50)}};globalThis.__pub={};globalThis.__priv={};globalThis.__evi={};globalThis.__fn={};
 globalThis.createImageBitmap=async()=>({width:4000,height:3000,close(){}});
 URL.createObjectURL=()=>'blob:x';URL.revokeObjectURL=()=>{};
 HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},drawImage(){},set fillStyle(v){},set imageSmoothingQuality(v){}});
 HTMLCanvasElement.prototype.toBlob=function(cb,type){cb(new Blob([new Uint8Array(150*1024)],{type}))};
});
afterEach(()=>{cleanup();delete globalThis.createImageBitmap});
const myPage=async()=>{app('/me');await signIn(fb('participant'));await waitFor(()=>screen.getByText('Send evidence'))};
const choose=async f=>{await act(async()=>{fireEvent.change(screen.getByLabelText('Photo'),{target:{files:[f]}})});await waitFor(()=>screen.getByText(/Photo ready/))};
describe('sending evidence (My page)',()=>{
 it('reads the position from the original photo, says so, uploads the small copy and sends the position as numbers',async()=>{
  await myPage();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});fireEvent.change(screen.getByLabelText('Species'),{target:{value:'Snapper'}});
  await choose(jpegWithGps());
  expect(screen.getByTestId('gps-note').textContent).toMatch(/has a location.*organiser will see a map link/);
  await act(async()=>{fireEvent.submit(screen.getByText('Send').closest('form'))});
  await waitFor(()=>screen.getByText('Sent to the organiser.'));
  expect(uploads).toHaveLength(1);const [path,blob,opts]=uploads[0];
  expect(path).toMatch(/^evidence\/e1\/u1\/[0-9a-f]{20}\.jpg$/);expect(blob.type).toBe('image/jpeg');expect(blob.size).toBe(150*1024);expect(opts).toEqual({contentType:'image/jpeg'});
  expect(calls).toHaveLength(1);const [name,d]=calls[0];expect(name).toBe('submitEvidence');
  expect(d.eventId).toBe('e1');expect(d.species).toBe('Snapper');expect(path.endsWith(d.evidenceId+'.jpg')).toBe(true);
  expect(d.gps.lat).toBeCloseTo(-41.28667,4);expect(d.gps.lng).toBeCloseTo(174.77639,4);expect(d.gps.alt).toBe(12);
 });
 it('says when a photo has no location, and sends no position',async()=>{
  await myPage();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});
  await choose(plain());expect(screen.getByTestId('gps-note').textContent).toMatch(/no location/);
  await act(async()=>{fireEvent.submit(screen.getByText('Send').closest('form'))});await waitFor(()=>screen.getByText('Sent to the organiser.'));
  expect('gps' in calls[0][1]).toBe(false);
 });
 it('shows the server\'s reason when sending fails, keeps the photo ready to retry',async()=>{
  globalThis.__fn.submitEvidence=async()=>{throw new Error('The photo did not upload. Please try again.')};
  await myPage();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});await choose(plain());
  await act(async()=>{fireEvent.submit(screen.getByText('Send').closest('form'))});await waitFor(()=>screen.getByRole('alert'));
  expect(screen.getByRole('alert').textContent).toMatch(/did not upload/);expect(screen.getByText('Send').disabled).toBe(false);
 });
 it('lists the person\'s own photos with the organiser\'s decision and reason',async()=>{
  globalThis.__evi={a:{userId:'u1',userName:'Pat',photoPath:'evidence/e1/u1/a.jpg',species:'Snapper',status:'Approved',weight:2.4,createdAt:ts(-1)},b:{userId:'u1',userName:'Pat',photoPath:'evidence/e1/u1/b.jpg',species:'Kahawai',status:'Rejected',reason:'Fish not visible',createdAt:ts(-2)},c:{userId:'someoneelse',species:'Kingfish',status:'Pending'}};
  await myPage();await waitFor(()=>screen.getByText(/Snapper · 2.4 kg/));
  expect(screen.getByText('Fish not visible')).toBeTruthy();expect(screen.queryByText(/Kingfish/,{selector:'.g'})).toBeNull();
 });
});
describe('reviewing evidence (organiser)',()=>{
 const items=()=>({a:{userId:'u2',userName:'Alice',photoPath:'evidence/e1/u2/a.jpg',species:'Snapper',status:'Pending',weight:null,lat:-41.28646,lng:174.776236,alt:23.5,createdAt:ts(-1)},
  b:{userId:'u3',userName:'Bob',photoPath:'evidence/e1/u3/b.jpg',species:'Kahawai',status:'Pending',weight:null,createdAt:ts(-2)}});
 const manage=async(role='organiser',uid='o1')=>{globalThis.__evi=items();app('/manage');await signIn(fb(role,uid));await waitFor(()=>screen.getByText('Taupō Cup',{selector:'h1'}));fireEvent.click(screen.getByText('Evidence',{selector:'button'}));await waitFor(()=>screen.getByText('Alice'))};
 it('shows a Google Maps link, the coordinates and altitude when the photo had a position',async()=>{
  await manage();const a=screen.getByText('Photo location on Google Maps').closest('a');
  expect(a.getAttribute('href')).toBe('https://www.google.com/maps/search/?api=1&query=-41.28646,174.776236');expect(a.target).toBe('_blank');expect(a.rel).toContain('noopener');
  expect(screen.getByText(/-41\.28646, 174\.77624 · altitude 23\.5 m/)).toBeTruthy();
 });
 it('says "No location in this photo" when there was none, and warns that locations are only a hint',async()=>{
  await manage();expect(screen.getAllByText('No location in this photo')).toHaveLength(1);expect(screen.getAllByText('Photo location on Google Maps')).toHaveLength(1);
  expect(screen.getByText(/can be edited, so treat a location as a hint/)).toBeTruthy();
 });
 it('shows the photo, and it opens full size',async()=>{
  await manage();await waitFor(()=>screen.getAllByLabelText('Open photo full size'));
  expect(screen.getAllByLabelText('Open photo full size')[0].getAttribute('href')).toMatch(/^https:\/\/files\.test\/evidence\/e1\/u[23]\//);
 });
 it('approves with a weight through the server',async()=>{
  globalThis.__fn.reviewEvidence=async()=>({status:'Approved'});await manage();
  fireEvent.change(screen.getByLabelText('Weight (kg) for Alice'),{target:{value:'2.35'}});fireEvent.click(within(screen.getByText('Alice').closest('.li')).getByText('Approve'));
  await waitFor(()=>expect(calls.some(c=>c[0]==='reviewEvidence')).toBe(true));
  expect(calls.find(c=>c[0]==='reviewEvidence')[1]).toEqual({eventId:'e1',evidenceId:'a',status:'Approved',weight:'2.35'});
 });
 it('only lets an organiser reject once a reason is written',async()=>{
  globalThis.__fn.reviewEvidence=async()=>({status:'Rejected'});await manage();
  const row=within(screen.getByText('Bob').closest('.li')),btn=row.getByText('Reject');expect(btn.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Reason for rejecting Bob's photo"),{target:{value:'Not taken at the lake'}});expect(btn.disabled).toBe(false);fireEvent.click(btn);
  await waitFor(()=>expect(calls.some(c=>c[0]==='reviewEvidence')).toBe(true));
  expect(calls.find(c=>c[0]==='reviewEvidence')[1]).toEqual({eventId:'e1',evidenceId:'b',status:'Rejected',reason:'Not taken at the lake'});
 });
 it('shows a decided photo as a badge, with Change to review it again',async()=>{
  await manage();cleanup();globalThis.__evi={a:{...items().a,status:'Approved',weight:2.35,reviewedBy:'o1'}};app('/manage');await signIn(fb('organiser','o1'));
  await waitFor(()=>screen.getByText('Taupō Cup',{selector:'h1'}));fireEvent.click(screen.getByText('Evidence',{selector:'button'}));await waitFor(()=>screen.getByText('Approved · 2.35 kg'));
  expect(screen.queryByText('Reject')).toBeNull();fireEvent.click(screen.getByText('Change'));expect(screen.getByText('Reject')).toBeTruthy();expect(screen.getByLabelText('Weight (kg) for Alice').value).toBe('2.35');
 });
 it('ranks approved weights on the Scores tab',async()=>{
  globalThis.__evi={a:{userName:'Alice',status:'Approved',weight:2,createdAt:ts(-1)},b:{userName:'Alice',status:'Approved',weight:1.5,createdAt:ts(-2)},c:{userName:'Bob',status:'Approved',weight:3,createdAt:ts(-3)},d:{userName:'Cara',status:'Rejected',weight:9,createdAt:ts(-4)}};
  app('/manage');await signIn(fb('organiser','o1'));await waitFor(()=>screen.getByText('Taupō Cup',{selector:'h1'}));fireEvent.click(screen.getByText('Scores',{selector:'button'}));
  await waitFor(()=>screen.getByText('3.5 kg'));const rows=[...document.querySelectorAll('.li')].map(r=>r.textContent);expect(rows).toEqual(['1Alice3.5 kg','2Bob3 kg']);
 });
});
describe('photo drop area (My page)',()=>{
 const area=()=>screen.getByRole('button',{name:/Add photo|Replace photo/});
 const drop=async f=>{await act(async()=>{fireEvent.drop(area(),{dataTransfer:{files:[f]}})});};
 it('offers a drop area instead of a plain file button, with Send off until a photo is ready',async()=>{
  await myPage();expect(screen.getByText('Drag a photo here, or tap to choose')).toBeTruthy();expect(screen.getByText(/JPEG, PNG or WebP · up to 15 MB/)).toBeTruthy();
  expect(screen.getByText('Send').disabled).toBe(true);
 });
 it('takes a dropped photo: reads its location, shows a preview, then sends it',async()=>{
  await myPage();fireEvent.change(screen.getByLabelText('Event'),{target:{value:'e1'}});
  await drop(jpegWithGps());await waitFor(()=>screen.getByText(/Photo ready/));
  expect(screen.getByAltText('Photo preview')).toBeTruthy();expect(screen.getByTestId('gps-note').textContent).toMatch(/has a location/);expect(screen.getByText('Send').disabled).toBe(false);
  await act(async()=>{fireEvent.submit(screen.getByText('Send').closest('form'))});await waitFor(()=>screen.getByText('Sent to the organiser.'));
  expect(calls[0][1].gps.lat).toBeCloseTo(-41.28667,4);expect(uploads).toHaveLength(1);
  // ready for the next photo: drop area empty again, but the event stays chosen
  expect(screen.getByText('Drag a photo here, or tap to choose')).toBeTruthy();expect(screen.queryByAltText('Photo preview')).toBeNull();expect(screen.getByLabelText('Event').value).toBe('e1');expect(screen.getByText('Send').disabled).toBe(true);
 });
 it('refuses a dropped file that is not a JPEG, PNG or WebP',async()=>{
  await myPage();await drop(new File(['x'],'notes.pdf',{type:'application/pdf'}));
  expect(screen.getByRole('status').textContent).toMatch(/JPEG, PNG or WebP/);expect(screen.getByText('Send').disabled).toBe(true);expect(screen.queryByAltText('Photo preview')).toBeNull();
 });
 it('a refused file clears the earlier photo, so the wrong one is never sent',async()=>{
  await myPage();await drop(plain());await waitFor(()=>screen.getByText(/Photo ready/));expect(screen.getByText('Send').disabled).toBe(false);
  await drop(new File([new Uint8Array(16*1024*1024)],'huge.jpg',{type:'image/jpeg'}));
  expect(screen.getByRole('status').textContent).toMatch(/over 15 MB/);expect(screen.getByText('Send').disabled).toBe(true);
 });
 it('Remove empties the drop area; Replace and the Enter key open the file chooser',async()=>{
  await myPage();const input=screen.getByLabelText('Photo'),click=vi.spyOn(input,'click');
  fireEvent.keyDown(area(),{key:'Enter'});expect(click).toHaveBeenCalledTimes(1);fireEvent.click(area());expect(click).toHaveBeenCalledTimes(2);
  await drop(plain());await waitFor(()=>screen.getByText(/Photo ready/));
  fireEvent.click(screen.getByText('Replace'));expect(click).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByText('Remove'));expect(screen.getByText('Drag a photo here, or tap to choose')).toBeTruthy();expect(screen.getByText('Send').disabled).toBe(true);
 });
 it('the chooser inside it still works (tap on a phone)',async()=>{
  await myPage();await choose(plain());expect(screen.getByAltText('Photo preview')).toBeTruthy();
 });
});
