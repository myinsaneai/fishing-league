const test=require('node:test');
const assert=require('node:assert');
const {makeRegistration}=require('./registration');
const H=3600e3,NOW=new Date('2026-10-14T00:00:00Z'),at=h=>new Date(NOW.getTime()+h*H);
// A small in-memory Firestore: documents, equality queries, and transactions that insist on reads before writes.
function fakeDb(){
 const m=new Map(),st={n:0},clone=x=>structuredClone(x);
 const snap=p=>({exists:m.has(p),id:p.split('/').pop(),data:()=>clone(m.get(p))});
 const q=(p,f=[])=>({_q:true,where:(k,op,v)=>q(p,[...f,[k,v]]),
  get:async()=>({docs:[...m.entries()].filter(([k,v])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')&&f.every(([a,b])=>v[a]===b)).map(([k])=>snap(k))}),
  add:async d=>{const id='m'+(++st.n);m.set(`${p}/${id}`,clone(d));return {path:`${p}/${id}`}}});
 const doc=p=>({path:p,id:p.split('/').pop(),get:async()=>snap(p),update:async d=>{if(!m.has(p))throw new Error('NOT_FOUND');m.set(p,{...m.get(p),...clone(d)})},set:async d=>{m.set(p,clone(d))}});
 return {m,doc,collection:p=>q(p),
  async runTransaction(fn){
   let wrote=false;const pend=[];
   const tx={async get(x){if(wrote)throw new Error('reads must come before writes');return x._q?x.get():snap(x.path)},
    set(r,d,o){wrote=true;pend.push(()=>m.set(r.path,o?.merge?{...(m.get(r.path)||{}),...clone(d)}:clone(d)))},
    update(r,d){wrote=true;pend.push(()=>{if(!m.has(r.path))throw new Error('NOT_FOUND '+r.path);m.set(r.path,{...m.get(r.path),...clone(d)})})}};
   const out=await fn(tx);pend.forEach(f=>f());return out}};
}
function setup({now=NOW,event={},users={}}={}){
 const db=fakeDb(),mails=[];
 const accounts={org:{email:'org@x.com',claims:{role:'organiser'}},admin:{email:'admin@x.com',claims:{role:'admin'}},other:{email:'other@x.com',claims:{role:'organiser'}},...Object.fromEntries(['a','b','c','d','e','f'].map(u=>[u,{email:u+'@x.com'}])),...users};
 const auth={getUser:async uid=>{const a=accounts[uid];if(!a)throw new Error('no user');return {uid,email:a.email,disabled:!!a.disabled,customClaims:a.claims}}};
 db.m.set('events/e1',{name:'Taupō Cup',status:'published',format:'Individual',limit:2,ownerId:'org',waterbody:'Lake Taupō',region:'Waikato',startsAt:at(48),endsAt:at(52),...event});
 const r=makeRegistration({auth,db,ts:()=>'TS',now:()=>now,siteUrl:()=>'https://site.test',mail:async n=>{mails.push(n)}});
 const as=(uid,data)=>({auth:{uid},data});
 const reg=(uid,x={})=>r.registerForEvent(as(uid,{eventId:'e1',name:'Person '+uid,phone:'021 123 456',acceptRules:true,...x}));
 const get=p=>db.m.get(p),counts=()=>db.m.get('events/e1').counts,status=uid=>db.m.get(`events/e1/registrations/${uid}`)?.status;
 return {db,r,mails,as,reg,get,counts,status};
}
const code=p=>p.then(()=>null,e=>e.code||e.message);
test('registers, saves three copies, counts the spot, and emails the person and the organiser',async()=>{
 const {reg,get,counts,mails}=setup();const out=await reg('a');
 assert.deepEqual(out,{status:'Accepted',order:1,waitlistPosition:0});
 assert.deepEqual(counts(),{accepted:1,waitlist:0,seq:1});
 assert.deepEqual(get('events/e1/registrations/a'),{uid:'a',name:'Person a',status:'Accepted',teamName:'',clubId:'',order:1,confirmed:false,createdAt:'TS',updatedAt:'TS'});
 assert.deepEqual(get('events/e1/registrationPrivate/a'),{uid:'a',phone:'021 123 456',email:'a@x.com',updatedAt:'TS'});
 assert.equal(get('users/a/registrations/e1').status,'Accepted');
 assert.deepEqual(mails.map(m=>m.to),['a@x.com','org@x.com']);assert.match(mails[0].subject,/registered.*Taupō Cup/);assert.match(mails[0].text,/https:\/\/site\.test\/me/);
});
test('the public copy never holds the phone number or email',async()=>{
 const {reg,get}=setup();await reg('a');const p=JSON.stringify(get('events/e1/registrations/a'));assert.ok(!p.includes('021')&&!p.includes('@'));
});
test('the last spot goes to one person; the next is waitlisted in order',async()=>{
 const {reg,counts,status,mails}=setup();
 await reg('a');await reg('b');const w1=await reg('c'),w2=await reg('d');
 assert.deepEqual([status('a'),status('b'),status('c'),status('d')],['Accepted','Accepted','Waitlist','Waitlist']);
 assert.deepEqual([w1.waitlistPosition,w2.waitlistPosition],[1,2]);assert.deepEqual(counts(),{accepted:2,waitlist:2,seq:4});
 assert.match(mails.find(m=>m.to==='c@x.com').subject,/waitlist/);
});
test('checks the details',async()=>{
 const {reg,r,as}=setup({event:{format:'Team'}});
 assert.equal(await code(reg('a',{name:'A'})),'invalid-argument');assert.equal(await code(reg('a',{phone:'abc'})),'invalid-argument');
 assert.equal(await code(reg('a',{acceptRules:false})),'invalid-argument');assert.equal(await code(reg('a',{eventId:''})),'invalid-argument');
 assert.equal(await code(reg('a')),'invalid-argument');                       // team event needs a team name
 assert.equal(await code(reg('a',{teamName:'The Reelers',clubId:'nope'})),'invalid-argument');
 assert.equal(await code(r.registerForEvent({data:{}})),'unauthenticated');assert.equal(await code(reg('a',{eventId:'zzz',teamName:'T1'})),'not-found');
 assert.equal((await reg('a',{teamName:' The   Reelers '})).status,'Accepted');
});
test('a team name is kept for team events only, and an approved club is accepted',async()=>{
 const {reg,get,db}=setup({event:{format:'Team'}});db.m.set('clubs/c1',{name:'Club',status:'approved'});db.m.set('clubs/c2',{name:'Pending',status:'pending'});
 await reg('a',{teamName:'The Reelers',clubId:'c1'});assert.equal(get('events/e1/registrations/a').teamName,'The Reelers');assert.equal(get('events/e1/registrations/a').clubId,'c1');
 assert.equal(await code(reg('b',{teamName:'Two',clubId:'c2'})),'invalid-argument');
 const t=setup();await t.reg('a',{teamName:'Ignored'});assert.equal(t.get('events/e1/registrations/a').teamName,'');
});
test('registration closes at the start by default, or at the end if the organiser chose so',async()=>{
 const underway={startsAt:at(-1),endsAt:at(3)};
 assert.equal(await code(setup({event:underway}).reg('a')),'failed-precondition');
 assert.equal((await setup({event:{...underway,registrationCloses:'end'}}).reg('a')).status,'Accepted');
 assert.equal(await code(setup({event:{startsAt:at(-5),endsAt:at(-1),registrationCloses:'end'}}).reg('a')),'failed-precondition');
 assert.equal((await setup({event:{startsAt:at(2),endsAt:at(6)}}).reg('a')).status,'Accepted');
 assert.equal(await code(setup({event:{status:'draft'}}).reg('a')),'failed-precondition');assert.equal(await code(setup({event:{status:'pending'}}).reg('a')),'failed-precondition');assert.equal(await code(setup({event:{status:'cancelled'}}).reg('a')),'failed-precondition');
});
test('cannot register twice, or when the account is disabled',async()=>{
 const {reg}=setup();await reg('a');assert.equal(await code(reg('a')),'already-exists');
 assert.equal(await code(setup({users:{a:{email:'a@x.com',disabled:true}}}).reg('a')),'permission-denied');
});
test('cancelling a spot promotes the first person on the waitlist and emails them',async()=>{
 const {reg,r,as,counts,status,mails,get}=setup();
 await reg('a');await reg('b');await reg('c');await reg('d');mails.length=0;
 const out=await r.cancelRegistration(as('a',{eventId:'e1'}));
 assert.equal(out.status,'Cancelled');assert.deepEqual([status('a'),status('b'),status('c'),status('d')],['Cancelled','Accepted','Accepted','Waitlist']);
 assert.deepEqual(counts(),{accepted:2,waitlist:1,seq:4});assert.equal(get('users/c/registrations/e1').status,'Accepted');
 assert.deepEqual(mails.map(m=>m.to).sort(),['a@x.com','c@x.com']);assert.match(mails.find(m=>m.to==='c@x.com').subject,/spot opened up/);
});
test('cancelling from the waitlist only changes the waitlist',async()=>{
 const {reg,r,as,counts,status}=setup();await reg('a');await reg('b');await reg('c');
 await r.cancelRegistration(as('c',{eventId:'e1'}));assert.equal(status('c'),'Cancelled');assert.deepEqual(counts(),{accepted:2,waitlist:0,seq:3});
});
test('cancelling is refused when there is nothing to cancel, after the start, or once checked in',async()=>{
 const t=setup();assert.equal(await code(t.r.cancelRegistration(t.as('a',{eventId:'e1'}))),'failed-precondition');
 await t.reg('a');await t.r.cancelRegistration(t.as('a',{eventId:'e1'}));assert.equal(await code(t.r.cancelRegistration(t.as('a',{eventId:'e1'}))),'failed-precondition');
 const late=setup();await late.reg('a');const l2=makeRegistration({auth:{getUser:async uid=>({uid,email:'a@x.com',customClaims:{}})},db:late.db,ts:()=>'TS',now:()=>at(49),mail:async()=>{}});
 assert.equal(await code(l2.cancelRegistration({auth:{uid:'a'},data:{eventId:'e1'}})),'failed-precondition');
 const s=setup();await s.reg('a');await s.r.setRegistrationStatus(s.as('org',{eventId:'e1',uid:'a',status:'On site'}));assert.equal(await code(s.r.cancelRegistration(s.as('a',{eventId:'e1'}))),'failed-precondition');
});
test('a person can register again after cancelling, at the back of the queue',async()=>{
 const {reg,r,as,counts,status,get}=setup();await reg('a');await reg('b');await reg('c');
 await r.cancelRegistration(as('a',{eventId:'e1'}));assert.equal(status('c'),'Accepted');
 const again=await reg('a');assert.equal(again.status,'Waitlist');assert.equal(get('events/e1/registrations/a').order,4);assert.deepEqual(counts(),{accepted:2,waitlist:1,seq:4});
});
test('only the organiser or an admin can change a registration',async()=>{
 const {reg,r,as}=setup();await reg('a');const ch=(uid,status='Disqualified')=>r.setRegistrationStatus(as(uid,{eventId:'e1',uid:'a',status}));
 assert.equal(await code(ch('b')),'permission-denied');assert.equal(await code(ch('a')),'permission-denied');assert.equal(await code(ch('other')),'permission-denied');
 assert.equal((await ch('org')).status,'Disqualified');assert.equal((await r.setRegistrationStatus(as('admin',{eventId:'e1',uid:'a',status:'Accepted'}))).status,'Accepted');
});
test('organiser changes: on site, decline, disqualify and waitlist free spots for the waitlist',async()=>{
 const {reg,r,as,counts,status,mails}=setup();const set=(uid,s)=>r.setRegistrationStatus(as('org',{eventId:'e1',uid,status:s}));
 await reg('a');await reg('b');await reg('c');await reg('d');mails.length=0;
 await set('a','On site');assert.deepEqual(counts(),{accepted:2,waitlist:2,seq:4});
 await set('b','Declined');assert.equal(status('c'),'Accepted');assert.deepEqual(counts(),{accepted:2,waitlist:1,seq:4});
 assert.deepEqual(mails.map(m=>m.to).sort(),['b@x.com','c@x.com']);
 await set('c','Disqualified');assert.equal(status('d'),'Accepted');assert.deepEqual(counts(),{accepted:2,waitlist:0,seq:4});
 await reg('e');assert.equal(status('e'),'Waitlist');
 await set('d','Waitlist');assert.deepEqual([status('d'),status('e')],['Waitlist','Accepted']);assert.deepEqual(counts(),{accepted:2,waitlist:1,seq:6});
});
test('organiser rules: no spots left, on site only after accepting, no change after the person cancelled, no change of nothing',async()=>{
 const {reg,r,as}=setup();const set=(uid,s)=>r.setRegistrationStatus(as('org',{eventId:'e1',uid,status:s}));
 await reg('a');await reg('b');await reg('c');
 assert.equal(await code(set('c','Accepted')),'failed-precondition');assert.equal(await code(set('c','On site')),'failed-precondition');
 assert.equal(await code(set('a','Cancelled')),'invalid-argument');assert.equal(await code(set('a','Whatever')),'invalid-argument');assert.equal(await code(set('zed','Declined')),'not-found');
 assert.equal((await set('a','Accepted')).status,'Accepted');
 await r.cancelRegistration(as('a',{eventId:'e1'}));assert.equal(await code(set('a','Accepted')),'failed-precondition');
});
test('moving someone to the waitlist needs a full event',async()=>{
 const {reg,r,as}=setup({event:{limit:3}});const set=(uid,s)=>r.setRegistrationStatus(as('org',{eventId:'e1',uid,status:s}));
 await reg('a');await reg('b');await set('b','Declined');
 assert.equal(await code(set('b','Waitlist')),'failed-precondition');   // a spot is free
 assert.equal(await code(set('a','Waitlist')),'failed-precondition');   // nobody else is waiting
});
test('the organiser can accept a waitlisted person once there is room',async()=>{
 const {reg,r,as,counts,status,db}=setup();await reg('a');await reg('b');await reg('c');
 db.m.get('events/e1').limit=3;await r.setRegistrationStatus(as('org',{eventId:'e1',uid:'c',status:'Accepted'}));assert.equal(status('c'),'Accepted');assert.deepEqual(counts(),{accepted:3,waitlist:0,seq:3});
});
test('confirming attendance',async()=>{
 const {reg,r,as,get}=setup();await reg('a');await reg('b');await reg('c');
 await r.confirmAttendance(as('a',{eventId:'e1'}));assert.equal(get('events/e1/registrations/a').confirmed,true);assert.equal(get('users/a/registrations/e1').confirmed,true);
 assert.equal(await code(r.confirmAttendance(as('c',{eventId:'e1'}))),'failed-precondition');   // waitlisted people cannot confirm
});
test('a higher limit moves people up from the waitlist, oldest first',async()=>{
 const {reg,r,counts,status,db,mails}=setup();await reg('a');await reg('b');await reg('c');await reg('d');await reg('e');mails.length=0;
 db.m.get('events/e1').limit=4;const moved=await r.fillSpots('e1');
 assert.equal(moved,2);assert.deepEqual(['c','d','e'].map(status),['Accepted','Accepted','Waitlist']);assert.deepEqual(counts(),{accepted:4,waitlist:1,seq:5});assert.deepEqual(mails.map(m=>m.to).sort(),['c@x.com','d@x.com']);
 assert.equal(await r.fillSpots('e1'),0);
});
test('reminders go once, to accepted people, for events starting in 2 to 3 days',async()=>{
 const {reg,r,db,mails,status}=setup({event:{limit:5,startsAt:at(60),endsAt:at(64)}});
 db.m.set('events/e2',{name:'Too soon',status:'published',limit:5,ownerId:'org',startsAt:at(24),endsAt:at(28)});
 await reg('a');await reg('b');await r.setRegistrationStatus({auth:{uid:'org'},data:{eventId:'e1',uid:'b',status:'Declined'}});mails.length=0;
 assert.equal(await r.remind(),1);assert.deepEqual(mails.map(m=>m.to),['a@x.com']);assert.match(mails[0].subject,/Reminder/);
 assert.equal(await r.remind(),0);assert.equal(db.m.get('events/e1/registrations/a').reminderSentAt,'TS');
});
test('whatever people do, the counts match the registrations and spots are never over-filled',async()=>{
 const {reg,r,as,db,counts}=setup({event:{limit:4}});
 let seed=7;const rnd=n=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed%n};
 const people=['a','b','c','d','e','f'],stats=['Accepted','Waitlist','On site','Disqualified','Declined'];
 for(let i=0;i<300;i++){
  const u=people[rnd(6)],k=rnd(3);
  try{
   if(k===0)await reg(u);
   else if(k===1)await r.cancelRegistration(as(u,{eventId:'e1'}));
   else await r.setRegistrationStatus(as('org',{eventId:'e1',uid:u,status:stats[rnd(5)]}));
  }catch(e){if(!e.code)throw e}
  const docs=[...db.m.entries()].filter(([k])=>/^events\/e1\/registrations\/[a-z]$/.test(k)).map(([,v])=>v);
  const a=docs.filter(d=>['Accepted','On site'].includes(d.status)).length,w=docs.filter(d=>d.status==='Waitlist').length,c=counts()||{accepted:0,waitlist:0};
  assert.equal(c.accepted,a,'accepted at step '+i);assert.equal(c.waitlist,w,'waitlist at step '+i);assert.ok(a<=4,'over-filled at step '+i);
  for(const [k,v] of db.m.entries()){const m=k.match(/^events\/e1\/registrations\/([a-z])$/);if(m)assert.equal(db.m.get(`users/${m[1]}/registrations/e1`).status,v.status,'mirror out of step '+i)}
  // nobody waits while a spot is free
  assert.ok(!(w>0&&a<4),'someone waiting with a free spot at step '+i);
 }
});
