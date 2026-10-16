const {HttpsError}=require('firebase-functions/v2/https');
const ACTIVE=['Accepted','On site'],ADMINS=['admin','superadmin'];
const MAX_BYTES=5*1024*1024,MAX_PER_PERSON=30;
const E=(code,msg)=>new HttpsError(code,msg);
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const num=v=>typeof v==='number'&&Number.isFinite(v);
const P={ev:id=>`events/${id}`,reg:(id,u)=>`events/${id}/registrations/${u}`,all:id=>`events/${id}/evidence`,one:(id,x)=>`events/${id}/evidence/${x}`};
// The position the browser read from the original photo. It is only a hint for the organiser, so a bad value is dropped, not an error.
const cleanGps=g=>{
 if(!g||!num(g.lat)||!num(g.lng)||Math.abs(g.lat)>90||Math.abs(g.lng)>180||(g.lat===0&&g.lng===0))return null;
 const r=(n,d)=>Math.round(n*10**d)/10**d,out={lat:r(g.lat,6),lng:r(g.lng,6)};
 if(num(g.alt)&&g.alt>-1000&&g.alt<20000)out.alt=r(g.alt,1);
 return out;
};
exports.cleanGps=cleanGps;
// files.meta(path) gives the stored file's {size,contentType}, or null when it does not exist.
exports.makeEvidence=({auth,db,ts,files})=>{
 const who=async req=>{
  if(!req.auth)throw E('unauthenticated','Sign in first.');
  const u=await auth.getUser(req.auth.uid);
  if(u.disabled)throw E('permission-denied','This account is disabled.');
  return {uid:u.uid,name:u.displayName||u.email||'',role:u.customClaims?.role||'participant'};
 };
 // A person taking part in the event sends a photo they already uploaded to Storage. The record is made here (never by the browser)
 // so the person, the species, the status and the position cannot be forged or set to "Approved".
 const submitEvidence=async req=>{
  const me=await who(req),d=req.data||{};
  const eventId=String(d.eventId||''),id=String(d.evidenceId||''),species=clean(d.species);
  if(!eventId)throw E('invalid-argument','Choose an event.');
  if(!/^[A-Za-z0-9]{10,40}$/.test(id))throw E('invalid-argument','Missing photo reference.');
  if(species.length<1||species.length>40)throw E('invalid-argument','Choose the species.');
  const path=`evidence/${eventId}/${me.uid}/${id}.jpg`;
  const meta=await files.meta(path);
  if(!meta)throw E('failed-precondition','The photo did not upload. Please try again.');
  if(meta.contentType!=='image/jpeg'||Number(meta.size)>MAX_BYTES)throw E('invalid-argument','That photo is not accepted. Choose a JPEG under 5 MB.');
  const gps=cleanGps(d.gps);
  await db.runTransaction(async tx=>{
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists)throw E('not-found','That event does not exist.');
   if(evSnap.data().status!=='published')throw E('failed-precondition','This event is not open.');
   const reg=await tx.get(db.doc(P.reg(eventId,me.uid)));
   if(!reg.exists||!ACTIVE.includes(reg.data().status))throw E('permission-denied','Only people taking part in this event can send evidence.');
   if((await tx.get(db.doc(P.one(eventId,id)))).exists)throw E('already-exists','That photo was already sent.');
   const mine=await tx.get(db.collection(P.all(eventId)).where('userId','==',me.uid));
   if(mine.docs.length>=MAX_PER_PERSON)throw E('resource-exhausted',`You can send up to ${MAX_PER_PERSON} photos for one event.`);
   tx.set(db.doc(P.one(eventId,id)),{userId:me.uid,userName:reg.data().name||me.name,photoPath:path,species,status:'Pending',weight:null,reason:'',...(gps||{}),createdAt:ts(),updatedAt:ts()});
  });
  return {id,hasLocation:!!gps};
 };
 // The organiser (or an admin) approves a photo, with its weight when known, or rejects it with a reason.
 const reviewEvidence=async req=>{
  const me=await who(req),d=req.data||{},eventId=String(d.eventId||''),id=String(d.evidenceId||''),status=d.status;
  if(!eventId||!id)throw E('invalid-argument','Choose a photo.');
  if(!['Approved','Rejected'].includes(status))throw E('invalid-argument','Approve or reject the photo.');
  let weight=null,reason='';
  if(status==='Approved'){
   const raw=d.weight===undefined||d.weight===null?'':String(d.weight).trim();
   if(raw!==''){weight=Number(raw);if(!Number.isFinite(weight)||weight<0||weight>10000)throw E('invalid-argument','Enter the weight in kilograms, for example 2.35.');weight=Math.round(weight*100)/100}
  }else{
   reason=clean(d.reason);
   if(reason.length<3||reason.length>300)throw E('invalid-argument','Give a short reason (3 to 300 characters) for rejecting the photo.');
  }
  await db.runTransaction(async tx=>{
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists)throw E('not-found','That event does not exist.');
   if(evSnap.data().ownerId!==me.uid&&!ADMINS.includes(me.role))throw E('permission-denied','Only the organiser or an admin can review evidence.');
   if(!(await tx.get(db.doc(P.one(eventId,id)))).exists)throw E('not-found','That photo does not exist.');
   tx.update(db.doc(P.one(eventId,id)),{status,weight,reason,reviewedBy:me.uid,reviewedByName:me.name,reviewedAt:ts(),updatedAt:ts()});
  });
  return {status,weight};
 };
 return {submitEvidence,reviewEvidence};
};
