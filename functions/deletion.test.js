const test=require('node:test');
const assert=require('node:assert');
const {makeDeletion}=require('./deletion');
// In-memory Firestore (documents, equality / array-contains queries, transactions that insist on reads before writes) and Storage.
function fakeDb(){
 const m=new Map(),clone=x=>structuredClone(x);
 const snap=p=>({exists:m.has(p),id:p.split('/').pop(),data:()=>clone(m.get(p))});
 const q=(p,f=[])=>({where:(k,op,v)=>q(p,[...f,[k,op,v]]),get:async()=>({docs:[...m.entries()].filter(([k,v])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')&&f.every(([a,op,b])=>op==='array-contains'?(v[a]||[]).includes(b):v[a]===b)).map(([k])=>snap(k))})});
 const doc=p=>({path:p,get:async()=>snap(p),delete:async()=>{m.delete(p)},update:async d=>{if(!m.has(p))throw new Error('NOT_FOUND '+p);m.set(p,{...m.get(p),...clone(d)})},set:async d=>{m.set(p,clone(d))}});
 return {m,doc,collection:p=>q(p),async runTransaction(fn){
  let wrote=false;const pend=[];
  const tx={async get(r){if(wrote)throw new Error('reads must come before writes');return snap(r.path)},
   update(r,d){wrote=true;pend.push(()=>m.set(r.path,{...m.get(r.path),...clone(d)}))},delete(r){wrote=true;pend.push(()=>m.delete(r.path))}};
  const out=await fn(tx);pend.forEach(f=>f());return out}};
}
function setup(){
 const db=fakeDb(),log=[],spots=[];
 const accounts={sa:{role:'superadmin'},ad:{role:'admin'},ad2:{role:'admin'},org:{role:'organiser'},p1:{},p2:{},p3:{},off:{role:'admin',disabled:true}};
 const auth={
  getUser:async uid=>{const a=accounts[uid];if(!a)throw new Error('no user');return {uid,email:uid+'@x.com',disabled:!!a.disabled,customClaims:a.role?{role:a.role}:undefined}},
  updateUser:async(uid,p)=>{log.push(['disable',uid]);Object.assign(accounts[uid],{disabled:p.disabled})},
  revokeRefreshTokens:async uid=>{log.push(['revoke',uid])},
  deleteUser:async uid=>{log.push(['authDelete',uid]);delete accounts[uid]}};
 const stored=new Set(['events/e1/cover','evidence/e1/p1/a.jpg','evidence/e1/p2/b.jpg','clubs/c1/cover','avatars/p1','avatars/p2','evidence/e2/p1/x.jpg','events/e2/cover']);
 const files={list:async pre=>[...stored].filter(n=>n.startsWith(pre)),removePrefix:async pre=>{for(const n of [...stored])if(n.startsWith(pre))stored.delete(n)},remove:async p=>{stored.delete(p)}};
 const purge=async ref=>{for(const k of [...db.m.keys()])if(k===ref.path||k.startsWith(ref.path+'/'))db.m.delete(k)};
 const S=(p,d)=>db.m.set(p,d);
 S('clubs/c1',{name:'Club One',ownerId:'org'});S('clubs/c2',{name:'Club Two',ownerId:'ad'});
 S('events/e1',{name:'Cup',ownerId:'org',clubId:'c1',status:'published',limit:1,counts:{accepted:1,waitlist:1,seq:2}});
 S('events/e1/registrations/p1',{status:'Accepted',order:1});S('events/e1/registrationPrivate/p1',{email:'p1@x.com'});S('users/p1/registrations/e1',{status:'Accepted'});
 S('events/e1/registrations/p2',{status:'Waitlist',order:2});S('events/e1/registrationPrivate/p2',{email:'p2@x.com'});S('users/p2/registrations/e1',{status:'Waitlist'});
 S('events/e1/evidence/ev1',{userId:'p1',photoPath:'evidence/e1/p1/a.jpg'});S('events/e1/evidence/ev2',{userId:'p2',photoPath:'evidence/e1/p2/b.jpg'});
 S('events/e2',{name:'Other',ownerId:'ad',clubId:'c2',status:'published',limit:5,counts:{accepted:1,waitlist:0,seq:1}});
 S('events/e2/registrations/p1',{status:'Accepted',order:1});S('events/e2/registrationPrivate/p1',{email:'p1@x.com'});S('users/p1/registrations/e2',{status:'Accepted'});
 S('roleRequests/p2',{uid:'p2',status:'pending'});S('users/p1',{clubIds:['c1','c2']});S('users/p2',{clubIds:['c1']});S('users/org',{clubIds:[]});S('users/p3',{clubIds:[]});
 S('mail/m1',{to:'p1@x.com'});S('mail/m2',{to:'p2@x.com'});S('mail/m3',{to:'p1@x.com'});S('mail/m4',{to:'p3@x.com'});
 const d=makeDeletion({auth,db,files,purge,fillSpots:async e=>{spots.push(e)}});
 const as=(uid,data)=>({auth:{uid},data});
 const has=p=>db.m.has(p),under=p=>[...db.m.keys()].filter(k=>k===p||k.startsWith(p+'/'));
 return {d,db,as,log,spots,stored,accounts,has,under,files};
}
const code=p=>p.then(()=>null,e=>e.code||e.message);
test('only signed-in admins can delete, and they must say what to delete',async()=>{
 const {d,as}=setup();
 for(const f of ['deleteClub','deleteEvent','deleteUser']){
  assert.equal(await code(d[f]({data:{}})),'unauthenticated');
  assert.equal(await code(d[f](as('p1',{clubId:'c1',eventId:'e1',uid:'p2'}))),'permission-denied');
  assert.equal(await code(d[f](as('org',{clubId:'c1',eventId:'e1',uid:'p2'}))),'permission-denied');
  assert.equal(await code(d[f](as('off',{clubId:'c1',eventId:'e1',uid:'p2'}))),'permission-denied');
 }
 assert.equal(await code(d.deleteClub(as('ad',{}))),'invalid-argument');
 assert.equal(await code(d.deleteEvent(as('ad',{eventId:'e1/registrations/p1'}))),'invalid-argument');
 assert.equal(await code(d.deleteUser(as('ad',{uid:5}))),'invalid-argument');
});
test('a dry run reports what would go and removes nothing',async()=>{
 const x=setup(),before=x.db.m.size,files=x.stored.size;
 assert.deepEqual((await x.d.deleteEvent(x.as('ad',{eventId:'e1',dryRun:true}))).counts,{registrations:2,evidence:2,files:3});
 assert.deepEqual((await x.d.deleteClub(x.as('ad',{clubId:'c1',dryRun:true}))).counts,{hostedEvents:1,members:2,files:1});
 assert.deepEqual((await x.d.deleteUser(x.as('ad',{uid:'p1',dryRun:true}))).counts,{ownedEvents:0,ownedClubs:0,registrations:2,evidence:1,emails:2,avatar:true});
 assert.equal(x.db.m.size,before);assert.equal(x.stored.size,files);assert.deepEqual(x.log,[]);
});
test('deleting an event removes it with registrations, evidence, everyone\'s own copy and its pictures, and nothing else',async()=>{
 const x=setup();
 const r=await x.d.deleteEvent(x.as('ad',{eventId:'e1'}));
 assert.deepEqual(r.counts,{registrations:2,evidence:2,files:3});
 assert.deepEqual(x.under('events/e1'),[]);
 assert.ok(!x.has('users/p1/registrations/e1')&&!x.has('users/p2/registrations/e1'));
 assert.ok(x.has('users/p1/registrations/e2')&&x.has('events/e2/registrations/p1')&&x.has('events/e2'));
 assert.deepEqual([...x.stored].sort(),['avatars/p1','avatars/p2','clubs/c1/cover','events/e2/cover','evidence/e2/p1/x.jpg']);
 assert.equal(await code(x.d.deleteEvent(x.as('ad',{eventId:'e1'}))),'not-found');
});
test('deleting a club removes it and its picture; hosted events stay but lose the club, and people stop following it',async()=>{
 const x=setup();
 const r=await x.d.deleteClub(x.as('ad',{clubId:'c1'}));
 assert.deepEqual(r.counts,{hostedEvents:1,members:2,files:1});
 assert.ok(!x.has('clubs/c1')&&x.has('clubs/c2'));
 assert.equal(x.db.m.get('events/e1').clubId,'');assert.equal(x.db.m.get('events/e2').clubId,'c2');
 assert.deepEqual(x.db.m.get('users/p1').clubIds,['c2']);assert.deepEqual(x.db.m.get('users/p2').clubIds,[]);
 assert.ok(!x.stored.has('clubs/c1/cover'));assert.ok(x.has('events/e1/registrations/p1'));   // the event and its registrations are untouched
 assert.equal(await code(x.d.deleteClub(x.as('ad',{clubId:'c1'}))),'not-found');
});
test('deleting a waitlisted user frees nothing: counts go down, their data and pictures go, the account goes last',async()=>{
 const x=setup();
 const r=await x.d.deleteUser(x.as('ad',{uid:'p2'}));
 assert.deepEqual(r.counts,{ownedEvents:0,ownedClubs:0,registrations:1,evidence:1,emails:1,avatar:true});
 assert.deepEqual(x.db.m.get('events/e1').counts,{accepted:1,waitlist:0,seq:2});
 assert.ok(!x.has('events/e1/registrations/p2')&&!x.has('events/e1/registrationPrivate/p2')&&!x.has('events/e1/evidence/ev2'));
 assert.deepEqual(x.under('users/p2'),[]);assert.ok(!x.has('roleRequests/p2'));   // their organiser request goes too
assert.ok(!x.has('mail/m2')&&x.has('mail/m1')&&x.has('mail/m4'));
 assert.ok(!x.stored.has('evidence/e1/p2/b.jpg')&&!x.stored.has('avatars/p2')&&x.stored.has('avatars/p1')&&x.stored.has('evidence/e1/p1/a.jpg'));
 assert.deepEqual(x.spots,[]);                                         // no accepted spot was freed
 assert.deepEqual(x.log,[['disable','p2'],['revoke','p2'],['authDelete','p2']]);
 assert.ok(x.has('events/e1/registrations/p1'));                       // other people are untouched
});
test('deleting a user with accepted spots frees them (the waitlist can move up) and removes their evidence and emails',async()=>{
 const x=setup();
 await x.d.deleteUser(x.as('ad',{uid:'p1'}));
 assert.deepEqual(x.db.m.get('events/e1').counts,{accepted:0,waitlist:1,seq:2});assert.deepEqual(x.db.m.get('events/e2').counts,{accepted:0,waitlist:0,seq:1});
 assert.deepEqual(x.spots.sort(),['e1','e2']);
 assert.ok(!x.has('events/e1/evidence/ev1')&&x.has('events/e1/evidence/ev2'));
 assert.ok(!x.stored.has('evidence/e1/p1/a.jpg')&&!x.stored.has('evidence/e2/p1/x.jpg')&&!x.stored.has('avatars/p1'));
 assert.ok(!x.has('mail/m1')&&!x.has('mail/m3')&&x.has('mail/m2'));
 assert.ok(!x.has('events/e2/registrations/p1')&&!x.has('events/e2/registrationPrivate/p1')&&!x.has('users/p1'));
});
test('rules for who can be deleted',async()=>{
 const x=setup();
 assert.equal(await code(x.d.deleteUser(x.as('ad',{uid:'ad'}))),'failed-precondition');
 assert.equal(await code(x.d.deleteUser(x.as('sa',{uid:'sa'}))),'failed-precondition');
 assert.equal(await code(x.d.deleteUser(x.as('ad',{uid:'ad2'}))),'permission-denied');
 assert.equal(await code(x.d.deleteUser(x.as('ad',{uid:'sa'}))),'permission-denied');
 assert.equal(await code(x.d.deleteUser(x.as('ad',{uid:'ghost'}))),'not-found');
 assert.deepEqual(x.log,[]);
 assert.equal(await code(x.d.deleteUser(x.as('sa',{uid:'ad2'}))),null);   // a superadmin can delete an admin
});
test('a user who owns events or clubs is only deleted together with them, when that is chosen',async()=>{
 const x=setup();
 assert.deepEqual((await x.d.deleteUser(x.as('ad',{uid:'org',dryRun:true}))).counts,{ownedEvents:1,ownedClubs:1,registrations:0,evidence:0,emails:0,avatar:false});
 assert.equal(await code(x.d.deleteUser(x.as('ad',{uid:'org'}))),'failed-precondition');
 assert.deepEqual(x.log,[]);assert.ok(x.has('events/e1')&&x.has('clubs/c1'));   // refused before anything was touched
 await x.d.deleteUser(x.as('ad',{uid:'org',deleteOwned:true}));
 assert.deepEqual(x.under('events/e1'),[]);assert.ok(!x.has('clubs/c1')&&!x.has('users/org'));
 assert.ok(!x.has('users/p1/registrations/e1')&&!x.has('users/p2/registrations/e1')&&x.has('users/p1/registrations/e2'));
 assert.ok(!x.stored.has('events/e1/cover')&&!x.stored.has('clubs/c1/cover')&&!x.stored.has('evidence/e1/p1/a.jpg'));
 assert.deepEqual(x.log.map(l=>l[0]),['disable','revoke','authDelete']);
});
test('if something fails midway, the sign-in account is kept (already locked) so the deletion can be repeated',async()=>{
 const x=setup();
 const bad=makeDeletion({auth:{getUser:async u=>({uid:u,email:u+'@x.com',customClaims:u==='ad'?{role:'admin'}:undefined}),updateUser:async()=>{x.log.push('locked')},revokeRefreshTokens:async()=>{},deleteUser:async()=>{x.log.push('authDelete')}},db:x.db,files:x.files,purge:async()=>{throw new Error('boom')},fillSpots:async()=>{}});
 assert.equal(await code(bad.deleteUser(x.as('ad',{uid:'p3'}))),'boom');
 assert.deepEqual(x.log,['locked']);assert.ok(x.has('users/p3'));
});
