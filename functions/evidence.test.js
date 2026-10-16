const test=require('node:test');
const assert=require('node:assert');
const {makeEvidence,cleanGps}=require('./evidence');
// A small in-memory Firestore (documents, equality queries, transactions that insist on reads before writes) and Storage.
function fakeDb(){
 const m=new Map(),clone=x=>structuredClone(x);
 const snap=p=>({exists:m.has(p),id:p.split('/').pop(),data:()=>clone(m.get(p))});
 const q=(p,f=[])=>({_q:true,where:(k,op,v)=>q(p,[...f,[k,v]]),get:async()=>({docs:[...m.entries()].filter(([k,v])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')&&f.every(([a,b])=>v[a]===b)).map(([k])=>snap(k))})});
 const doc=p=>({path:p});
 return {m,doc,collection:p=>q(p),async runTransaction(fn){
  let wrote=false;const pend=[];
  const tx={async get(x){if(wrote)throw new Error('reads must come before writes');return x._q?x.get():snap(x.path)},
   set(r,d){wrote=true;pend.push(()=>m.set(r.path,clone(d)))},
   update(r,d){wrote=true;pend.push(()=>{if(!m.has(r.path))throw new Error('NOT_FOUND '+r.path);m.set(r.path,{...m.get(r.path),...clone(d)})})}};
  const out=await fn(tx);pend.forEach(f=>f());return out}};
}
const ID='abcdef0123456789abcd';
function setup({event={},files={}}={}){
 const db=fakeDb();
 const accounts={org:{email:'org@x.com',name:'Olivia',claims:{role:'organiser'}},other:{email:'o2@x.com',claims:{role:'organiser'}},admin:{email:'a@x.com',name:'Ada',claims:{role:'admin'}},a:{email:'a1@x.com'},b:{email:'b@x.com'},w:{email:'w@x.com'},c:{email:'c@x.com'},off:{email:'off@x.com',disabled:true}};
 const auth={getUser:async uid=>{const a=accounts[uid];if(!a)throw new Error('no user');return {uid,email:a.email,displayName:a.name,disabled:!!a.disabled,customClaims:a.claims}}};
 db.m.set('events/e1',{name:'Taupō Cup',status:'published',ownerId:'org',...event});
 db.m.set('events/e1/registrations/a',{name:'Alice Angler',status:'Accepted'});
 db.m.set('events/e1/registrations/b',{name:'Bob',status:'On site'});
 db.m.set('events/e1/registrations/w',{name:'Wendy',status:'Waitlist'});
 db.m.set('events/e1/registrations/c',{name:'Cara',status:'Cancelled'});
 const stored={[`evidence/e1/a/${ID}.jpg`]:{size:'300000',contentType:'image/jpeg'},[`evidence/e1/b/${ID}.jpg`]:{size:'300000',contentType:'image/jpeg'},[`evidence/e1/w/${ID}.jpg`]:{size:'300000',contentType:'image/jpeg'},[`evidence/e1/c/${ID}.jpg`]:{size:'300000',contentType:'image/jpeg'},...files};
 const ev=makeEvidence({auth,db,ts:()=>'TS',files:{meta:async p=>stored[p]||null}});
 const as=(uid,data)=>({auth:{uid},data});
 const send=(uid,x={})=>ev.submitEvidence(as(uid,{eventId:'e1',evidenceId:ID,species:'Snapper',...x}));
 const review=(uid,x={})=>ev.reviewEvidence(as(uid,{eventId:'e1',evidenceId:ID,status:'Approved',...x}));
 return {db,ev,send,review,as,stored,get:p=>db.m.get(p),item:()=>db.m.get(`events/e1/evidence/${ID}`)};
}
const code=p=>p.then(()=>null,e=>e.code||e.message);
test('saves the evidence record with the position read from the photo, waiting for review',async()=>{
 const {send,item}=setup();
 const out=await send('a',{gps:{lat:-41.28646,lng:174.776236,alt:23.5}});
 assert.deepEqual(out,{id:ID,hasLocation:true});
 assert.deepEqual(item(),{userId:'a',userName:'Alice Angler',photoPath:`evidence/e1/a/${ID}.jpg`,species:'Snapper',status:'Pending',weight:null,reason:'',lat:-41.28646,lng:174.776236,alt:23.5,createdAt:'TS',updatedAt:'TS'});
});
test('works without a position, and the record then has no position fields',async()=>{
 const {send,item}=setup();
 assert.deepEqual(await send('a'),{id:ID,hasLocation:false});
 assert.ok(!('lat' in item())&&!('lng' in item())&&!('alt' in item()));
});
test('a position without altitude is kept without altitude',async()=>{
 const {send,item}=setup();await send('a',{gps:{lat:-41.2,lng:174.7}});
 assert.equal(item().lat,-41.2);assert.ok(!('alt' in item()));
});
test('drops a position that makes no sense, but still saves the photo',async()=>{
 for(const gps of [{lat:0,lng:0},{lat:95,lng:10},{lat:10,lng:200},{lat:'1',lng:'2'},{lat:NaN,lng:1},null,'x',{lat:1}]){
  const {send,item}=setup();assert.equal((await send('a',{gps})).hasLocation,false,JSON.stringify(gps));assert.ok(!('lat' in item()));
 }
 assert.deepEqual(cleanGps({lat:-41.1234567891,lng:174.1,alt:99999}),{lat:-41.123457,lng:174.1});   // rounded; silly altitude dropped
});
test('the browser cannot choose the person, the status or the review fields',async()=>{
 const {send,item}=setup();
 await send('a',{userId:'b',userName:'Fake',status:'Approved',weight:99,reason:'hi',reviewedBy:'org'});
 const i=item();assert.equal(i.userId,'a');assert.equal(i.userName,'Alice Angler');assert.equal(i.status,'Pending');assert.equal(i.weight,null);assert.ok(!('reviewedBy' in i));
});
test('only people with an accepted or on-site registration can send',async()=>{
 const {send}=setup();
 assert.equal(await code(send('w')),'permission-denied');            // waitlist
 assert.equal(await code(send('c')),'permission-denied');            // cancelled
 assert.equal(await code(send('org')),'failed-precondition');        // not registered: no upload exists for them
 assert.equal(await code(send('b')),null);                           // on site
});
test('refuses missing uploads, wrong files and bad input',async()=>{
 const {send,ev,stored}=setup();
 assert.equal(await code(send('a',{evidenceId:'abcdef0123456789ZZZZ'})),'failed-precondition');   // nothing was uploaded
 stored[`evidence/e1/a/${ID}.jpg`]={size:String(6*1024*1024),contentType:'image/jpeg'};assert.equal(await code(send('a')),'invalid-argument');
 stored[`evidence/e1/a/${ID}.jpg`]={size:'1000',contentType:'image/png'};assert.equal(await code(send('a')),'invalid-argument');
 stored[`evidence/e1/a/${ID}.jpg`]={size:'1000',contentType:'image/jpeg'};
 assert.equal(await code(send('a',{species:'  '})),'invalid-argument');assert.equal(await code(send('a',{species:'x'.repeat(41)})),'invalid-argument');
 assert.equal(await code(send('a',{evidenceId:'../../x'})),'invalid-argument');assert.equal(await code(send('a',{eventId:''})),'invalid-argument');
 assert.equal(await code(ev.submitEvidence({data:{}})),'unauthenticated');assert.equal(await code(send('off')),'permission-denied');
 assert.equal(await code(send('a',{eventId:'zzz'})),'failed-precondition');
});
test('an event that is not published takes no evidence; the same photo is not saved twice',async()=>{
 const x=setup({event:{status:'draft'}});assert.equal(await code(x.send('a')),'failed-precondition');
 const {send}=setup();await send('a');assert.equal(await code(send('a')),'already-exists');
});
test('stops one person sending more than 30 photos for an event',async()=>{
 const {send,db}=setup();
 for(let i=0;i<30;i++)db.m.set('events/e1/evidence/old'+i,{userId:'a',status:'Pending'});
 db.m.set('events/e1/evidence/other',{userId:'b'});
 assert.equal(await code(send('a')),'resource-exhausted');assert.equal(await code(send('b')),null);
});
test('the organiser approves with a weight (rounded) and the reviewer is recorded',async()=>{
 const {send,review,item}=setup();await send('a');
 assert.deepEqual(await review('org',{weight:'2.346'}),{status:'Approved',weight:2.35});
 assert.deepEqual([item().status,item().weight,item().reviewedBy,item().reviewedByName,item().reviewedAt],['Approved',2.35,'org','Olivia','TS']);
 await review('org',{weight:''});assert.equal(item().weight,null);                 // weight is optional for now
});
test('rejecting needs a reason, and approving checks the weight',async()=>{
 const {send,review,item}=setup();await send('a');
 assert.equal(await code(review('org',{status:'Rejected'})),'invalid-argument');assert.equal(await code(review('org',{status:'Rejected',reason:'ab'})),'invalid-argument');
 await review('org',{status:'Rejected',reason:'  Fish not  visible '});assert.deepEqual([item().status,item().reason,item().weight],['Rejected','Fish not visible',null]);
 for(const weight of ['abc',-1,10001,'1e9'])assert.equal(await code(review('org',{weight})),'invalid-argument',String(weight));
 assert.equal(await code(review('org',{status:'Pending'})),'invalid-argument');
 await review('org',{weight:3});assert.deepEqual([item().status,item().reason],['Approved','']);   // a decision can be changed
});
test('only the event organiser or an admin can review',async()=>{
 const {send,review}=setup();await send('a');
 assert.equal(await code(review('other')),'permission-denied');assert.equal(await code(review('a')),'permission-denied');   // not even the person who sent it
 assert.equal(await code(review('admin')),null);
 assert.equal(await code(review('org',{evidenceId:'nope'})),'not-found');assert.equal(await code(review('org',{eventId:'zzz'})),'not-found');
});
