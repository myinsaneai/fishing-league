const {HttpsError}=require('firebase-functions/v2/https');
const {mails}=require('./emails');
const ROLES=['participant','organiser','admin','superadmin'];
const rank=r=>Math.max(0,ROLES.indexOf(r));
const roleOf=u=>u.customClaims?.role||'participant';
const E=(code,msg)=>new HttpsError(code,msg);
const MIN=20,MAX=1000,NOTE_MAX=300;
// Text from a form: tidy spaces and line breaks, keep paragraphs.
const tidy=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
exports.tidy=tidy;
// A participant asks to become an organiser (one request per person, kept in roleRequests/{uid}); an admin approves or declines it.
// Records are written here only (the Firestore rules give the browser read access to its own request and nothing else).
exports.makeOrganiserRequests=({auth,db,ts,mail=async()=>{},siteUrl=()=>''})=>{
 const site=()=>String(siteUrl()||'').trim().replace(/\/+$/,'');
 const who=async req=>{
  if(!req.auth)throw E('unauthenticated','Sign in first.');
  const u=await auth.getUser(req.auth.uid);
  if(u.disabled)throw E('permission-denied','This account is disabled.');
  return {uid:u.uid,role:roleOf(u),name:u.displayName||u.email||'',email:u.email||''};
 };
 const send=async n=>{try{await mail(n)}catch(e){console.warn('mail',e.message)}};   // a failed email must never undo the decision
 const admins=async()=>{
  const out=[];let token;
  do{const r=await auth.listUsers(1000,token);for(const u of r.users)if(!u.disabled&&u.email&&rank(roleOf(u))>=2)out.push(u.email);token=r.pageToken}while(token&&out.length<200);
  return out;
 };
 // The person asks (or, while it is still waiting, corrects the reason).
 const requestOrganiserRole=async req=>{
  const me=await who(req);
  if(me.role!=='participant')throw E('failed-precondition','You already have organiser access.');
  const reason=tidy((req.data||{}).reason);
  if(reason.length<MIN)throw E('invalid-argument',`Please explain in a few sentences why you would like to organise events (at least ${MIN} characters).`);
  if(reason.length>MAX)throw E('invalid-argument',`Please keep the explanation under ${MAX} characters.`);
  const ref=db.doc(`roleRequests/${me.uid}`);
  const created=await db.runTransaction(async tx=>{
   const s=await tx.get(ref);
   if(s.exists&&s.data().status==='pending'){tx.update(ref,{reason,name:me.name,email:me.email,updatedAt:ts()});return false}
   tx.set(ref,{uid:me.uid,name:me.name,email:me.email,reason,status:'pending',createdAt:ts(),updatedAt:ts(),decidedBy:null,decidedByName:'',decidedAt:null,note:''});
   return true;
  });
  if(created)for(const to of await admins())await send({to,...mails.organiserRequested({name:me.name||me.email,email:me.email,reason},site())});
  return {status:'pending',created};
 };
 // An admin approves or declines. Approving gives the organiser role straight away (the person sees it after their next token refresh).
 const decideOrganiserRequest=async req=>{
  const me=await who(req);
  if(rank(me.role)<2)throw E('permission-denied','Admins only.');
  const d=req.data||{},uid=d.uid;
  if(typeof uid!=='string'||!uid||uid.includes('/'))throw E('invalid-argument','Choose a request.');
  if(!['approve','decline'].includes(d.decision))throw E('invalid-argument','Approve or decline the request.');
  const note=tidy(d.note);
  if(note.length>NOTE_MAX)throw E('invalid-argument',`Please keep the note under ${NOTE_MAX} characters.`);
  if(d.decision==='decline'&&note.length<3)throw E('invalid-argument','Please give a short reason, so the person knows why.');
  const ref=db.doc(`roleRequests/${uid}`),first=await ref.get();
  if(!first.exists)throw E('not-found','That request does not exist.');
  if(first.data().status!=='pending')throw E('failed-precondition','This request was already decided.');
  let target;
  try{target=await auth.getUser(uid)}catch{throw E('not-found','That user no longer exists.')}
  const approve=d.decision==='approve';
  if(approve&&rank(roleOf(target))<1){
   await auth.setCustomUserClaims(uid,{role:'organiser'});
   await db.doc(`users/${uid}`).set({role:'organiser',disabled:!!target.disabled},{merge:true});
  }
  await db.runTransaction(async tx=>{
   const s=await tx.get(ref);
   if(!s.exists||s.data().status!=='pending')throw E('failed-precondition','This request was already decided.');
   tx.update(ref,{status:approve?'approved':'declined',decidedBy:me.uid,decidedByName:me.name,decidedAt:ts(),note,updatedAt:ts()});
  });
  if(target.email)await send({to:target.email,...(approve?mails.organiserApproved({name:first.data().name},site()):mails.organiserDeclined({name:first.data().name,note},site()))});
  return {status:approve?'approved':'declined'};
 };
 return {requestOrganiserRole,decideOrganiserRequest};
};
