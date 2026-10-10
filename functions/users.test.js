const test=require('node:test');
const assert=require('node:assert');
const {makeHandlers}=require('./users');
const mk=(uid,role,x={})=>({uid,email:uid+'@x.com',displayName:uid,disabled:false,emailVerified:true,customClaims:role?{role}:undefined,providerData:[{providerId:'google.com'}],metadata:{creationTime:'2026-01-01',lastSignInTime:'2026-02-01'},...x});
function setup(){
 const m=new Map([mk('sa','superadmin'),mk('ad','admin'),mk('ad2','admin'),mk('org','organiser'),mk('p1',undefined,{providerData:[{providerId:'password'}]})].map(u=>[u.uid,u]));
 const log={claims:[],updates:[],revoked:[],docs:[]};
 const auth={getUser:async uid=>{if(!m.has(uid))throw new Error('nope');return m.get(uid)},listUsers:async()=>({users:[...m.values()]}),setCustomUserClaims:async(uid,c)=>{log.claims.push([uid,c.role])},updateUser:async(uid,p)=>{log.updates.push([uid,p])},revokeRefreshTokens:async uid=>{log.revoked.push(uid)}};
 const db={doc:p=>({set:async d=>{log.docs.push([p,d])}})};
 return {h:makeHandlers(auth,db),log};
}
const as=(uid,data)=>({auth:{uid},data});
const code=p=>p.then(()=>null,e=>e.code);
test('only signed-in admins can use the handlers',async()=>{
 const {h}=setup();
 assert.equal(await code(h.listUsers({})),'unauthenticated');
 assert.equal(await code(h.listUsers(as('p1'))),'permission-denied');
 assert.equal(await code(h.updateUser(as('org',{uid:'p1',role:'organiser'}))),'permission-denied');
});
test('listUsers returns role, providers and status',async()=>{
 const {h}=setup();const r=await h.listUsers(as('ad'));
 const p1=r.users.find(u=>u.uid==='p1'),sa=r.users.find(u=>u.uid==='sa');
 assert.equal(r.users.length,5);assert.deepEqual(p1.providers,['password']);assert.equal(p1.role,'participant');assert.equal(sa.role,'superadmin');assert.equal(p1.disabled,false);
});
test('admin can promote a participant to organiser but not to admin',async()=>{
 const {h,log}=setup();
 await h.updateUser(as('ad',{uid:'p1',role:'organiser'}));
 assert.deepEqual(log.claims,[['p1','organiser']]);
 assert.equal(await code(h.updateUser(as('ad',{uid:'p1',role:'admin'}))),'permission-denied');
 assert.equal(await code(h.updateUser(as('ad',{uid:'ad2',role:'participant'}))),'permission-denied');
 assert.equal(await code(h.updateUser(as('ad',{uid:'ad2',disabled:true}))),'permission-denied');
});
test('superadmin can grant admin, and disabling revokes tokens and mirrors to Firestore',async()=>{
 const {h,log}=setup();
 await h.updateUser(as('sa',{uid:'p1',role:'admin'}));
 assert.deepEqual(log.claims,[['p1','admin']]);assert.deepEqual(log.revoked,[]);
 const r=await h.updateUser(as('sa',{uid:'org',disabled:true}));
 assert.deepEqual(log.updates,[['org',{disabled:true}]]);assert.deepEqual(log.revoked,['org']);
 assert.deepEqual(log.docs.at(-1),['users/org',{role:'organiser',disabled:true}]);assert.equal(r.disabled,true);
 await h.updateUser(as('sa',{uid:'ad',role:'participant'}));assert.ok(log.revoked.includes('ad'));
});
test('rejects self changes, bad input and unknown users',async()=>{
 const {h}=setup();
 assert.equal(await code(h.updateUser(as('sa',{uid:'sa',role:'participant'}))),'failed-precondition');
 assert.equal(await code(h.updateUser(as('sa',{uid:'p1',role:'boss'}))),'invalid-argument');
 assert.equal(await code(h.updateUser(as('sa',{uid:'p1',disabled:'yes'}))),'invalid-argument');
 assert.equal(await code(h.updateUser(as('sa',{uid:'ghost',role:'organiser'}))),'not-found');
});
