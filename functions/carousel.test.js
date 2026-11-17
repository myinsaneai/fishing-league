const test=require('node:test');
const assert=require('node:assert');
const {makeCarousel,MAX_ITEMS}=require('./carousel');
// A small in-memory Firestore (documents and collections) and Storage that remembers copies.
function setup({accounts={},stored,existing=0}={}){
 const m=new Map(),copies=[];
 const snap=p=>({exists:m.has(p),id:p.split('/').pop(),data:()=>structuredClone(m.get(p))});
 const db={doc:p=>({path:p,get:async()=>snap(p),set:async d=>{m.set(p,structuredClone(d))}}),
  collection:p=>({get:async()=>({docs:[...m.keys()].filter(k=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')).map(snap)})})};
 const users={admin:{role:'admin'},sa:{role:'superadmin'},org:{role:'organiser'},p:{role:'participant'},gone:{role:'admin',disabled:true},...accounts};
 const auth={getUser:async uid=>{const a=users[uid];if(!a)throw new Error('no user');return {uid,disabled:!!a.disabled,customClaims:{role:a.role}}}};
 const ID='abcdef0123456789abcd',path=`evidence/e1/a/${ID}.jpg`;
 m.set('events/e1',{name:'Taupō Cup',ownerId:'org'});
 m.set(`events/e1/evidence/${ID}`,{userId:'a',userName:'Alice Angler',species:'Snapper',status:'Approved',photoPath:path});
 for(let i=0;i<existing;i++)m.set(`carousel/old${i}`,{path:`carousel/old${i}.jpg`});
 const files={meta:async p=>(stored??{[path]:{size:'300000',contentType:'image/jpeg'}})[p]||null,copy:async(a,b)=>{copies.push([a,b])}};
 const c=makeCarousel({auth,db,ts:()=>'TS',files});
 const as=(uid,data)=>({auth:uid?{uid}:undefined,data});
 const add=(uid,x={})=>c.featureEvidencePhoto(as(uid,{eventId:'e1',evidenceId:ID,...x}));
 return {m,c,add,as,copies,ID,path};
}
const code=p=>p.then(()=>null,e=>e.code||e.message);
test('an admin copies an approved evidence photo into the carousel; the original stays where it is',async()=>{
 const {add,m,copies,ID,path}=setup();
 assert.deepEqual(await add('admin'),{id:`ev_${ID}`});
 assert.deepEqual(copies,[[path,`carousel/ev_${ID}.jpg`]]);
 assert.deepEqual(m.get(`carousel/ev_${ID}`),{path:`carousel/ev_${ID}.jpg`,caption:'Taupō Cup · Snapper',source:'evidence',eventId:'e1',evidenceId:ID,createdAt:'TS',createdBy:'admin'});
 assert.ok(m.has(`events/e1/evidence/${ID}`));
});
test('the person\'s name is never put in the carousel',async()=>{
 const {add,m}=setup();await add('sa');
 assert.ok(!JSON.stringify([...m.entries()].filter(([k])=>k.startsWith('carousel/'))).includes('Alice'));
});
test('a superadmin can too; everyone else, and anyone signed out, cannot',async()=>{
 const x=setup();assert.equal(await code(x.add('sa')),null);
 for(const [u,c] of [['org','permission-denied'],['p','permission-denied'],['gone','permission-denied'],[undefined,'unauthenticated'],['nobody','no user']]){
  const y=setup();assert.equal(await code(y.add(u)),c,String(u));assert.equal(y.copies.length,0);
 }
});
test('only approved photos can be added: pending and rejected ones cannot',async()=>{
 for(const status of ['Pending','Rejected']){
  const {add,m,ID,copies}=setup();m.set(`events/e1/evidence/${ID}`,{...m.get(`events/e1/evidence/${ID}`),status});
  assert.equal(await code(add('admin')),'failed-precondition');assert.equal(copies.length,0);assert.ok(![...m.keys()].some(k=>k.startsWith('carousel/')));
 }
});
test('bad or unknown references are refused without copying anything',async()=>{
 const x=setup();
 assert.equal(await code(x.add('admin',{eventId:''})),'invalid-argument');
 assert.equal(await code(x.add('admin',{eventId:'a/b'})),'invalid-argument');
 assert.equal(await code(x.add('admin',{evidenceId:'short'})),'invalid-argument');
 assert.equal(await code(x.add('admin',{evidenceId:'../../etc/passwd..'})),'invalid-argument');
 assert.equal(await code(x.add('admin',{eventId:'nope'})),'not-found');
 assert.equal(await code(x.add('admin',{evidenceId:'zzzzzzzzzzzz'})),'not-found');
 assert.equal(x.copies.length,0);
});
test('a record that points outside the event\'s evidence folder is refused (nothing outside can be copied)',async()=>{
 const {add,m,ID,copies}=setup();m.set(`events/e1/evidence/${ID}`,{...m.get(`events/e1/evidence/${ID}`),photoPath:'avatars/someone'});
 assert.equal(await code(add('admin')),'failed-precondition');assert.equal(copies.length,0);
});
test('adding the same photo twice is refused',async()=>{
 const {add,copies}=setup();await add('admin');assert.equal(await code(add('admin')),'already-exists');assert.equal(copies.length,1);
});
test('the carousel holds a limited number of photos',async()=>{
 const {add,copies}=setup({existing:MAX_ITEMS});assert.equal(await code(add('admin')),'failed-precondition');assert.equal(copies.length,0);
 const y=setup({existing:MAX_ITEMS-1});assert.equal(await code(y.add('admin')),null);
});
test('a missing photo file is reported, not copied',async()=>{
 const {add,copies,m}=setup({stored:{}});assert.equal(await code(add('admin')),'not-found');assert.equal(copies.length,0);assert.ok(![...m.keys()].some(k=>k.startsWith('carousel/')));
});
test('a long or untidy caption is tidied and cut',async()=>{
 const {add,m,ID}=setup();m.set('events/e1',{name:'  Taupō\n   Cup '+'x'.repeat(200)});await add('admin');
 const c=m.get(`carousel/ev_${ID}`).caption;assert.ok(c.length<=100);assert.ok(!/\s{2}|\n/.test(c));assert.match(c,/^Taupō Cup x/);
});
