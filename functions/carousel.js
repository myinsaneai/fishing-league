const {HttpsError}=require('firebase-functions/v2/https');
const ADMINS=['admin','superadmin'],MAX_ITEMS=30;
const E=(code,msg)=>new HttpsError(code,msg);
const ID=/^[A-Za-z0-9]{10,40}$/;
exports.MAX_ITEMS=MAX_ITEMS;
// The photo carousel on the Events page. Admins can upload their own pictures straight from the browser (see the rules);
// this function is for the other way in: an admin picks an APPROVED evidence photo. Evidence photos are private (only the person,
// the organiser and admins can read them), so the photo is COPIED into carousel/ (public to read) and the original stays private.
// The copy is made from the picture the browser already shrank and re-saved, which carries no hidden location data.
// files.meta(path) gives {size,contentType} or null when the file does not exist; files.copy(from,to) copies a stored file.
exports.makeCarousel=({auth,db,ts,files})=>{
 const who=async req=>{
  if(!req.auth)throw E('unauthenticated','Sign in first.');
  const u=await auth.getUser(req.auth.uid);
  if(u.disabled)throw E('permission-denied','This account is disabled.');
  const role=u.customClaims?.role||'participant';
  if(!ADMINS.includes(role))throw E('permission-denied','Only an admin can change the carousel.');
  return {uid:u.uid};
 };
 const featureEvidencePhoto=async req=>{
  const me=await who(req),d=req.data||{};
  const eventId=String(d.eventId||''),evidenceId=String(d.evidenceId||'');
  if(!eventId||eventId.length>100||eventId.includes('/'))throw E('invalid-argument','Choose an event.');
  if(!ID.test(evidenceId))throw E('invalid-argument','Missing photo reference.');
  const event=await db.doc(`events/${eventId}`).get();
  if(!event.exists)throw E('not-found','That event does not exist.');
  const one=await db.doc(`events/${eventId}/evidence/${evidenceId}`).get();
  if(!one.exists)throw E('not-found','That photo does not exist.');
  const x=one.data();
  if(x.status!=='Approved')throw E('failed-precondition','Only approved photos can be added to the carousel.');
  if(typeof x.photoPath!=='string'||!x.photoPath.startsWith(`evidence/${eventId}/`))throw E('failed-precondition','That photo cannot be used.');
  const id=`ev_${evidenceId}`,to=`carousel/${id}.jpg`;
  if((await db.doc(`carousel/${id}`).get()).exists)throw E('already-exists','That photo is already in the carousel.');
  if((await db.collection('carousel').get()).docs.length>=MAX_ITEMS)throw E('failed-precondition',`The carousel holds up to ${MAX_ITEMS} photos. Remove one first.`);
  if(!(await files.meta(x.photoPath)))throw E('not-found','The photo file is missing.');
  await files.copy(x.photoPath,to);
  // The caption is the event and the species. The person's name is never shown.
  const caption=[event.data().name,x.species].filter(Boolean).join(' · ').replace(/\s+/g,' ').trim().slice(0,100);
  await db.doc(`carousel/${id}`).set({path:to,caption,source:'evidence',eventId,evidenceId,createdAt:ts(),createdBy:me.uid});
  return {id};
 };
 return {featureEvidencePhoto};
};
