const test=require('node:test');
const assert=require('node:assert');
const {makeOrganiserRequests,tidy}=require('./organiser');
// In-memory Firestore (documents, merge-set, transactions that insist on reads before writes) and a fake sign-in service.
function setup(){
 const m=new Map(),clone=x=>structuredClone(x);
 const ref=p=>({path:p,get:async()=>({exists:m.has(p),data:()=>clone(m.get(p))}),set:async(d,o)=>{m.set(p,o?.merge?{...(m.get(p)||{}),...clone(d)}:clone(d))}});
 const db={doc:ref,async runTransaction(fn){let wrote=false;const pend=[];const tx={get:async r=>{if(wrote)throw new Error('reads must come before writes');return {exists:m.has(r.path),data:()=>clone(m.get(r.path))}},set(r,d){wrote=true;pend.push(()=>m.set(r.path,clone(d)))},update(r,d){wrote=true;pend.push(()=>{if(!m.has(r.path))throw new Error('NOT_FOUND');m.set(r.path,{...m.get(r.path),...clone(d)})})}};const out=await fn(tx);pend.forEach(f=>f());return out}};
 const mk=(uid,role,x={})=>({uid,email:uid+'@x.com',displayName:uid==='p1'?'Pat Participant':uid,disabled:false,customClaims:role?{role}:undefined,...x});
 const users=new Map([mk('sa','superadmin'),mk('ad','admin'),mk('ad2','admin',{disabled:true}),mk('org','organiser'),mk('p1'),mk('p2'),mk('off',undefined,{disabled:true}),mk('noemail','admin',{email:''})].map(u=>[u.uid,u]));
 const claims=[],mails=[];
 const auth={getUser:async uid=>{if(!users.has(uid))throw new Error('nope');return users.get(uid)},listUsers:async()=>({users:[...users.values()]}),setCustomUserClaims:async(uid,c)=>{claims.push([uid,c.role]);users.get(uid).customClaims=c}};
 const o=makeOrganiserRequests({auth,db,ts:()=>'TS',siteUrl:()=>'https://site.test/',mail:async n=>{mails.push(n)}});
 const as=(uid,data)=>({auth:{uid},data});
 const REASON='I run the Taupō fly-fishing club and would like to organise our monthly competitions.';
 return {o,m,as,claims,mails,users,REASON,ask:(uid='p1',reason=REASON)=>o.requestOrganiserRole(as(uid,{reason}))};
}
const code=p=>p.then(()=>null,e=>e.code||e.message);
test('a participant asks: the request is saved as waiting and the admins are told once',async()=>{
 const x=setup();const r=await x.ask();
 assert.deepEqual(r,{status:'pending',created:true});
 assert.deepEqual(x.m.get('roleRequests/p1'),{uid:'p1',name:'Pat Participant',email:'p1@x.com',reason:x.REASON,status:'pending',createdAt:'TS',updatedAt:'TS',decidedBy:null,decidedByName:'',decidedAt:null,note:''});
 assert.deepEqual(x.mails.map(n=>n.to).sort(),['ad@x.com','sa@x.com']);   // enabled admins with an address only
 assert.match(x.mails[0].subject,/New organiser request: Pat Participant/);assert.match(x.mails[0].text,/https:\/\/site\.test\/admin/);assert.ok(!/site\.test\/\//.test(x.mails[0].text));assert.ok(x.mails[0].text.includes(x.REASON));
});
test('the reason must be a real explanation (20 to 1000 characters) and is tidied',async()=>{
 const x=setup();
 for(const bad of ['','short',' '.repeat(40),'x '.repeat(5),null,42,'a'.repeat(1001)])assert.equal(await code(x.ask('p1',bad)),'invalid-argument',String(bad).slice(0,20));
 assert.equal(await code(x.o.requestOrganiserRole(x.as('p1',{}))),'invalid-argument');   // no reason sent at all
 assert.equal(await code(x.o.requestOrganiserRole(x.as('p1'))),'invalid-argument');       // no data at all
 assert.equal(await code(x.ask('p1','  I   would like to organise\r\n\r\n\r\n\r\nlocal  club events.  ')),null);
 assert.equal(x.m.get('roleRequests/p1').reason,'I would like to organise\n\nlocal club events.');
 assert.equal(tidy('a\r\nb'),'a\nb');
});
test('only signed-in participants can ask; organisers and admins already have access',async()=>{
 const x=setup();
 assert.equal(await code(x.o.requestOrganiserRole({data:{reason:x.REASON}})),'unauthenticated');
 assert.equal(await code(x.ask('off')),'permission-denied');
 for(const u of ['org','ad','sa'])assert.equal(await code(x.ask(u)),'failed-precondition',u);
 assert.equal(x.m.size,0);
});
test('while waiting, asking again only corrects the reason: no new email, the date stays',async()=>{
 const x=setup();await x.ask();x.m.get('roleRequests/p1').createdAt='FIRST';x.mails.length=0;
 const r=await x.ask('p1','Actually, I also help with the Wellington sea-fishing league and its events.');
 assert.equal(r.created,false);assert.equal(x.mails.length,0);assert.equal(x.m.get('roleRequests/p1').createdAt,'FIRST');assert.match(x.m.get('roleRequests/p1').reason,/Wellington/);assert.equal(x.m.get('roleRequests/p1').status,'pending');
});
test('an admin approves: the organiser role is given, the request is closed and the person is emailed',async()=>{
 const x=setup();await x.ask();x.mails.length=0;
 assert.deepEqual(await x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'approve',note:'  Welcome aboard  '})),{status:'approved'});
 assert.deepEqual(x.claims,[['p1','organiser']]);assert.deepEqual(x.m.get('users/p1'),{role:'organiser',disabled:false});
 const r=x.m.get('roleRequests/p1');assert.deepEqual([r.status,r.decidedBy,r.decidedByName,r.decidedAt,r.note],['approved','ad','ad','TS','Welcome aboard']);
 assert.equal(x.mails.length,1);assert.equal(x.mails[0].to,'p1@x.com');assert.match(x.mails[0].subject,/You can now organise events/);assert.match(x.mails[0].text,/https:\/\/site\.test\/manage/);
});
test('an admin declines with a reason, which is emailed; the person can then ask again',async()=>{
 const x=setup();await x.ask();x.mails.length=0;
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'decline'}))),'invalid-argument');           // a reason is needed
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'decline',note:'no'}))),'invalid-argument');
 await x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'decline',note:'Please join a club first.'}));
 assert.deepEqual(x.claims,[]);assert.equal(x.m.get('roleRequests/p1').status,'declined');
 assert.match(x.mails[0].subject,/About your organiser request/);assert.match(x.mails[0].text,/Reason: Please join a club first\./);
 x.mails.length=0;assert.equal((await x.ask()).created,true);assert.equal(x.m.get('roleRequests/p1').status,'pending');assert.equal(x.m.get('roleRequests/p1').note,'');assert.equal(x.mails.length,2);   // admins are told about the new request
});
test('a request is decided once; only admins decide; bad input is refused',async()=>{
 const x=setup();await x.ask();
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('p2',{uid:'p1',decision:'approve'}))),'permission-denied');
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('org',{uid:'p1',decision:'approve'}))),'permission-denied');
 assert.equal(await code(x.o.decideOrganiserRequest({data:{uid:'p1',decision:'approve'}})),'unauthenticated');
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'maybe'}))),'invalid-argument');
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'a/b',decision:'approve'}))),'invalid-argument');
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'approve',note:'x'.repeat(301)}))),'invalid-argument');
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'p2',decision:'approve'}))),'not-found');
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'approve'}))),null);
 assert.equal(await code(x.o.decideOrganiserRequest(x.as('sa',{uid:'p1',decision:'decline',note:'too late'}))),'failed-precondition');
 assert.equal(x.m.get('roleRequests/p1').status,'approved');assert.equal(x.claims.length,1);
});
test('if the person is already an organiser (promoted another way), approving just closes the request, and a gone user is reported',async()=>{
 const x=setup();await x.ask();x.users.get('p1').customClaims={role:'organiser'};
 await x.o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'approve'}));assert.deepEqual(x.claims,[]);assert.equal(x.m.get('roleRequests/p1').status,'approved');
 const y=setup();await y.ask();y.users.delete('p1');assert.equal(await code(y.o.decideOrganiserRequest(y.as('ad',{uid:'p1',decision:'approve'}))),'not-found');
});
test('a failed email never undoes the decision',async()=>{
 const x=setup();const o=makeOrganiserRequests({auth:{getUser:async u=>x.users.get(u),listUsers:async()=>({users:[]}),setCustomUserClaims:async()=>{}},db:{doc:p=>({path:p,get:async()=>({exists:x.m.has(p),data:()=>x.m.get(p)}),set:async()=>{}}),runTransaction:async fn=>fn({get:async r=>({exists:true,data:()=>x.m.get(r.path)}),update:(r,d)=>x.m.set(r.path,{...x.m.get(r.path),...d})})},ts:()=>'TS',mail:async()=>{throw new Error('smtp down')}});
 x.m.set('roleRequests/p1',{status:'pending',name:'Pat'});
 assert.deepEqual(await o.decideOrganiserRequest(x.as('ad',{uid:'p1',decision:'approve'})),{status:'approved'});assert.equal(x.m.get('roleRequests/p1').status,'approved');
});
