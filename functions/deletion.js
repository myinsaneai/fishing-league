const {HttpsError}=require('firebase-functions/v2/https');
const ROLES=['participant','organiser','admin','superadmin'];
const rank=r=>Math.max(0,ROLES.indexOf(r));
const ACTIVE=['Accepted','On site'];
const E=(code,msg)=>new HttpsError(code,msg);
const countsOf=ev=>({accepted:0,waitlist:0,seq:0,...(ev.counts||{})});
const P={ev:id=>`events/${id}`,regs:id=>`events/${id}/registrations`,evid:id=>`events/${id}/evidence`,reg:(id,u)=>`events/${id}/registrations/${u}`,priv:(id,u)=>`events/${id}/registrationPrivate/${u}`,mine:u=>`users/${u}/registrations`};
// Permanent deletion of clubs, events and users, together with everything that belongs to them (records and pictures).
// Only admins can call these. Each one first answers a "dry run" (what would go), so the screen can show it before anything is removed.
//   files.list(prefix) -> file names;  files.removePrefix(prefix);  files.remove(path)
//   purge(docRef) deletes a document with all its subcollections;  fillSpots(eventId) lets the waitlist move up.
exports.makeDeletion=({auth,db,files,purge,fillSpots=async()=>0})=>{
 const who=async req=>{
  if(!req.auth)throw E('unauthenticated','Sign in first.');
  const u=await auth.getUser(req.auth.uid);
  const role=u.customClaims?.role||'participant';
  if(u.disabled||rank(role)<2)throw E('permission-denied','Admins only.');
  return {uid:u.uid,role};
 };
 const id=(req,k)=>{const v=(req.data||{})[k];if(typeof v!=='string'||!v||v.includes('/'))throw E('invalid-argument','Choose what to delete.');return v};
 // ---- events: the event, its registrations (public and private), evidence, each person's own copy, and its pictures
 const removeEvent=async(eventId,dry)=>{
  if(!(await db.doc(P.ev(eventId)).get()).exists)throw E('not-found','That event does not exist.');
  const regs=(await db.collection(P.regs(eventId)).get()).docs;
  const evidence=(await db.collection(P.evid(eventId)).get()).docs.length;
  const fileNames=[...await files.list(`events/${eventId}/`),...await files.list(`evidence/${eventId}/`)];
  const counts={registrations:regs.length,evidence,files:fileNames.length};
  if(dry)return counts;
  await Promise.all(regs.map(d=>db.doc(`${P.mine(d.id)}/${eventId}`).delete()));
  await files.removePrefix(`events/${eventId}/`);await files.removePrefix(`evidence/${eventId}/`);
  await purge(db.doc(P.ev(eventId)));
  return counts;
 };
 // ---- clubs: the club and its picture. Events it hosted stay (without the club) and people stop following it.
 const removeClub=async(clubId,dry)=>{
  if(!(await db.doc(`clubs/${clubId}`).get()).exists)throw E('not-found','That club does not exist.');
  const hosted=(await db.collection('events').where('clubId','==',clubId).get()).docs;
  const members=(await db.collection('users').where('clubIds','array-contains',clubId).get()).docs;
  const fileNames=await files.list(`clubs/${clubId}/`);
  const counts={hostedEvents:hosted.length,members:members.length,files:fileNames.length};
  if(dry)return counts;
  await Promise.all(hosted.map(d=>db.doc(P.ev(d.id)).update({clubId:''})));
  await Promise.all(members.map(d=>db.doc(`users/${d.id}`).update({clubIds:(d.data().clubIds||[]).filter(c=>c!==clubId)})));
  await files.removePrefix(`clubs/${clubId}/`);
  await db.doc(`clubs/${clubId}`).delete();
  return counts;
 };
 // ---- users
 const ownedBy=async uid=>({events:(await db.collection('events').where('ownerId','==',uid).get()).docs.map(d=>d.id),clubs:(await db.collection('clubs').where('ownerId','==',uid).get()).docs.map(d=>d.id)});
 // Takes one person out of one event: their three registration records go and the spot counts are put right.
 const detach=async(eventId,uid)=>{
  let wasActive=false;
  await db.runTransaction(async tx=>{
   wasActive=false;
   const evSnap=await tx.get(db.doc(P.ev(eventId))),regSnap=await tx.get(db.doc(P.reg(eventId,uid)));
   if(!regSnap.exists)return;
   const st=regSnap.data().status,active=ACTIVE.includes(st);
   if(evSnap.exists&&(active||st==='Waitlist')){const c=countsOf(evSnap.data());if(active)c.accepted=Math.max(0,c.accepted-1);else c.waitlist=Math.max(0,c.waitlist-1);tx.update(db.doc(P.ev(eventId)),{counts:c})}
   tx.delete(db.doc(P.reg(eventId,uid)));tx.delete(db.doc(P.priv(eventId,uid)));
   wasActive=active&&evSnap.exists;
  });
  await db.doc(`${P.mine(uid)}/${eventId}`).delete();
  if(wasActive)await fillSpots(eventId);
 };
 const removeUser=async(me,uid,dry,deleteOwned)=>{
  let target;
  try{target=await auth.getUser(uid)}catch{throw E('not-found','User not found.')}
  if(uid===me.uid)throw E('failed-precondition','You cannot delete your own account.');
  if(me.role!=='superadmin'&&rank(target.customClaims?.role||'participant')>1)throw E('permission-denied','Only a superadmin can delete admins.');
  const owned=await ownedBy(uid),ownedEvents=new Set(owned.events);
  const mirrors=(await db.collection(P.mine(uid)).get()).docs.map(d=>d.id).filter(e=>!ownedEvents.has(e));
  const evidence=[];
  for(const e of mirrors)evidence.push(...(await db.collection(P.evid(e)).where('userId','==',uid).get()).docs.map(d=>`${P.evid(e)}/${d.id}`));
  const mails=target.email?(await db.collection('mail').where('to','==',target.email).get()).docs:[];
  const avatar=(await files.list(`avatars/${uid}`)).length;
  const counts={ownedEvents:owned.events.length,ownedClubs:owned.clubs.length,registrations:mirrors.length,evidence:evidence.length,emails:mails.length,avatar:avatar>0};
  if(dry)return counts;
  if((owned.events.length||owned.clubs.length)&&!deleteOwned)throw E('failed-precondition',`This person owns ${owned.events.length} event(s) and ${owned.clubs.length} club(s). Choose to delete those too, or delete them first.`);
  // Lock the account first so nothing new appears while the data is removed; the sign-in account itself goes last, so a failed run can be repeated.
  await auth.updateUser(uid,{disabled:true});await auth.revokeRefreshTokens(uid);
  for(const e of owned.events)await removeEvent(e,false);
  for(const c of owned.clubs)await removeClub(c,false);
  for(const path of evidence)await db.doc(path).delete();
  for(const e of mirrors)await files.removePrefix(`evidence/${e}/${uid}/`);
  for(const e of mirrors)await detach(e,uid);
  await files.remove(`avatars/${uid}`);
  await Promise.all(mails.map(d=>db.doc(`mail/${d.id}`).delete()));
  await purge(db.doc(`users/${uid}`));
  await auth.deleteUser(uid);
  return counts;
 };
 const deleteClub=async req=>{await who(req);return {counts:await removeClub(id(req,'clubId'),!!req.data.dryRun)}};
 const deleteEvent=async req=>{await who(req);return {counts:await removeEvent(id(req,'eventId'),!!req.data.dryRun)}};
 const deleteUser=async req=>{const me=await who(req);return {counts:await removeUser(me,id(req,'uid'),!!req.data.dryRun,!!req.data.deleteOwned)}};
 return {deleteClub,deleteEvent,deleteUser};
};
