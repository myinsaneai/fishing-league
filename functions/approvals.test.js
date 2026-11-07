const test=require('node:test');
const assert=require('node:assert');
const {makeApprovalAlerts}=require('./approvals');
// A fake sign-in service (same users as the organiser tests) and a mail queue that, like the real one, refuses a repeated id.
function setup({fail=[]}={}){
 const mk=(uid,role,x={})=>({uid,email:uid+'@x.com',disabled:false,customClaims:role?{role}:undefined,...x});
 const users=[mk('sa','superadmin'),mk('ad','admin'),mk('ad2','admin',{disabled:true}),mk('org','organiser'),mk('p1'),mk('noemail','admin',{email:''})];
 const sent=new Map();
 const auth={listUsers:async()=>({users})};
 const a=makeApprovalAlerts({auth,siteUrl:()=>'https://site.test/',mail:async n=>{if(fail.includes(n.to))throw new Error('boom');if(!sent.has(n.id))sent.set(n.id,n)}});
 return {a,sent,mails:()=>[...sent.values()]};
}
const CLUB={name:'Taupō Fly Club',town:'Taupō',region:'Waikato',ownerName:'Pat',status:'pending'};
const EVENT={name:'Spring Cup',kind:'tournament',status:'pending',startsAt:new Date('2026-12-05T20:00:00Z'),waterbody:'Lake Taupō',region:'Waikato',ownerName:'Pat'};
test('a new pending club is announced to every enabled admin and superadmin, and nobody else',async()=>{
 const x=setup();const n=await x.a.clubWritten({eventId:'e1',before:null,after:CLUB});
 assert.equal(n,2);
 assert.deepEqual(x.mails().map(m=>m.to).sort(),['ad@x.com','sa@x.com']);   // not the disabled admin, the organiser, the participant or the admin without an address
 const m=x.mails()[0];
 assert.match(m.subject,/^New club waiting for approval: Taupō Fly Club$/);
 assert.match(m.text,/Taupō, Waikato/);assert.match(m.text,/Created by: Pat/);assert.match(m.text,/https:\/\/site\.test\/admin/);assert.ok(!/site\.test\/\//.test(m.text));
});
test('a new pending event is announced with its date, place and organiser',async()=>{
 const x=setup();await x.a.eventWritten({eventId:'e2',before:null,after:EVENT});
 assert.equal(x.sent.size,2);const m=x.mails()[0];
 assert.match(m.subject,/^New event waiting for approval: Spring Cup$/);
 assert.match(m.text,/When: .*2026/);assert.match(m.text,/Where: Lake Taupō, Waikato/);assert.match(m.text,/Organiser: Pat/);assert.match(m.text,/Approvals, Events/);
});
test('items that need no approval send nothing: approved, published, draft, rejected, deleted',async()=>{
 const x=setup();
 for(const s of ['approved','published','draft','rejected','cancelled',undefined])assert.equal(await x.a.clubWritten({eventId:'c'+s,before:null,after:{...CLUB,status:s}}),0,String(s));
 assert.equal(await x.a.eventWritten({eventId:'gone',before:EVENT,after:null}),0);
 assert.equal(x.sent.size,0);
});
test('edits of an item that is already pending, or approved, do not send again',async()=>{
 const x=setup();
 assert.equal(await x.a.eventWritten({eventId:'u1',before:EVENT,after:{...EVENT,name:'Spring Cup 2'}}),0);
 assert.equal(await x.a.eventWritten({eventId:'u2',before:{...EVENT,status:'published'},after:{...EVENT,status:'published'}}),0);
 assert.equal(await x.a.clubWritten({eventId:'u3',before:{...CLUB,status:'approved'},after:{...CLUB,status:'approved',tagline:'New'}}),0);
 assert.equal(x.sent.size,0);
});
test('a draft that is submitted, and a rejected item that is sent in again, both count (the second says so)',async()=>{
 const x=setup();
 assert.equal(await x.a.eventWritten({eventId:'s1',before:{...EVENT,status:'draft'},after:EVENT}),2);
 assert.match(x.mails()[0].subject,/^New event waiting for approval/);
 const y=setup();
 assert.equal(await y.a.clubWritten({eventId:'s2',before:{...CLUB,status:'rejected'},after:CLUB}),2);
 assert.match(y.mails()[0].subject,/^Club sent in again: Taupō Fly Club$/);assert.match(y.mails()[0].text,/was not approved/);
 assert.equal(await y.a.eventWritten({eventId:'s3',before:{...EVENT,status:'rejected'},after:EVENT}),2);
 assert.ok(y.mails().some(m=>/^Event sent in again/.test(m.subject)));
});
test('the same trigger delivered twice sends nothing twice (fixed mail ids); a different item sends its own',async()=>{
 const x=setup();
 await x.a.clubWritten({eventId:'same',before:null,after:CLUB});await x.a.clubWritten({eventId:'same',before:null,after:CLUB});
 assert.equal(x.sent.size,2);
 await x.a.clubWritten({eventId:'other',before:null,after:CLUB});await x.a.eventWritten({eventId:'same',before:null,after:EVENT});
 assert.equal(x.sent.size,6);   // club and event ids never clash, even for the same trigger id
 assert.ok([...x.sent.keys()].every(k=>/^approval-(club|event)-[\w-]+-[0-9a-f]{12}$/.test(k)));
});
test('one failing email does not stop the others, and a failing admin lookup never throws',async()=>{
 const x=setup({fail:['ad@x.com']});
 assert.equal(await x.a.clubWritten({eventId:'f1',before:null,after:CLUB}),1);
 assert.deepEqual(x.mails().map(m=>m.to),['sa@x.com']);
 const bad=makeApprovalAlerts({auth:{listUsers:async()=>{throw new Error('down')}},mail:async()=>{}});
 assert.equal(await bad.eventWritten({eventId:'f2',before:null,after:EVENT}),0);
});
test('names from forms are kept on one line and short, so they cannot break the subject',async()=>{
 const x=setup();
 await x.a.clubWritten({eventId:'n1',before:null,after:{...CLUB,name:'Bad\r\nBcc: x@y.com\n'+'z'.repeat(500)}});
 const m=x.mails()[0];
 assert.ok(!/[\r\n]/.test(m.subject));assert.ok(m.subject.length<200);
});
test('several pages of users are read, and the lookup is capped',async()=>{
 const page=(from,n,token)=>({users:Array.from({length:n},(_,i)=>({uid:'u'+(from+i),email:`u${from+i}@x.com`,customClaims:{role:'admin'}})),pageToken:token});
 const pages=[page(0,150,'t1'),page(150,40)];let i=0;const sent=new Map();
 const a=makeApprovalAlerts({auth:{listUsers:async()=>pages[i++]},mail:async n=>{sent.set(n.id,n)}});
 assert.equal(await a.eventWritten({eventId:'p',before:null,after:EVENT}),190);
});
