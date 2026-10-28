const {HttpsError}=require('firebase-functions/v2/https');
const {mails}=require('./emails');
const ACTIVE=['Accepted','On site'],HOLDING=['Accepted','Waitlist','On site'],ADMINS=['admin','superadmin'];
const ORGANISER_STATUSES=['Accepted','Waitlist','On site','Disqualified','Declined'];
const isActive=s=>ACTIVE.includes(s);
const toDate=x=>x?.toDate?x.toDate():new Date(x);
// Registration closes when the event starts, or when it ends if the organiser chose that.
const closeAtOf=ev=>ev.registrationCloses==='end'&&ev.endsAt?toDate(ev.endsAt):toDate(ev.startsAt);
const countsOf=ev=>({accepted:0,waitlist:0,seq:0,...(ev.counts||{})});
const E=(code,msg)=>new HttpsError(code,msg);
const clean=s=>String(s||'').trim().replace(/\s+/g,' ');
const phoneOk=p=>/^[+\d][\d\s().-]{5,24}$/.test(p);
const P={ev:id=>`events/${id}`,regs:id=>`events/${id}/registrations`,reg:(id,u)=>`events/${id}/registrations/${u}`,priv:(id,u)=>`events/${id}/registrationPrivate/${u}`,mine:(u,id)=>`users/${u}/registrations/${id}`};
// Everything that changes a registration goes through these functions, inside transactions, so the spot
// count, the waitlist and the three copies of each registration (public, private, the person's own) never disagree.
exports.makeRegistration=({auth,db,ts,now=()=>new Date(),siteUrl=()=>'',mail})=>{
 const site=()=>String(siteUrl()||'').trim().replace(/\/+$/,'');   // links are built as site()+'/me', so a trailing slash in the setting must not give '//me'
 const send=async notes=>{for(const n of notes)if(n.to){try{await mail(n)}catch(e){console.warn('mail',e.message)}}};
 const who=async req=>{
  if(!req.auth)throw E('unauthenticated','Sign in first.');
  const u=await auth.getUser(req.auth.uid);
  if(u.disabled)throw E('permission-denied','This account is disabled.');
  return {uid:u.uid,email:u.email||'',role:u.customClaims?.role||'participant'};
 };
 const ownerEmail=async ev=>{try{return (await auth.getUser(ev.ownerId)).email||''}catch{return ''}};
 // The first people on the waitlist (oldest first) who can take the free spots. Must be called before any write in the transaction.
 const waitlistFor=async(tx,eventId,spots,exceptUid)=>{
  if(spots<=0)return [];
  const snap=await tx.get(db.collection(P.regs(eventId)).where('status','==','Waitlist'));
  const list=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(r=>r.uid!==exceptUid).sort((a,b)=>a.order-b.order).slice(0,spots);
  for(const r of list){const p=await tx.get(db.doc(P.priv(eventId,r.uid)));r.email=p.exists?p.data().email:''}
  return list;
 };
 const promote=(tx,eventId,ev,c,list,notes)=>{
  for(const r of list){
   tx.update(db.doc(P.reg(eventId,r.uid)),{status:'Accepted',updatedAt:ts()});
   tx.set(db.doc(P.mine(r.uid,eventId)),{status:'Accepted',updatedAt:ts()},{merge:true});
   c.accepted++;c.waitlist--;
   notes.push({to:r.email,...mails.promoted(ev,site())});
  }
 };
 const registerForEvent=async req=>{
  const me=await who(req),d=req.data||{};
  const eventId=String(d.eventId||''),name=clean(d.name),phone=String(d.phone||'').trim(),teamName=clean(d.teamName),clubId=String(d.clubId||'');
  if(!eventId)throw E('invalid-argument','Choose an event.');
  if(name.length<2||name.length>60)throw E('invalid-argument','Enter your full name.');
  if(!phoneOk(phone))throw E('invalid-argument','Enter a phone number the organiser can reach you on.');
  if(d.acceptRules!==true)throw E('invalid-argument','Please accept the event rules to register.');
  const notes=[];let ev,reg;
  const out=await db.runTransaction(async tx=>{
   notes.length=0;
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists)throw E('not-found','That event does not exist.');
   ev=evSnap.data();
   const regSnap=await tx.get(db.doc(P.reg(eventId,me.uid)));
   let clubOk=true;
   if(clubId){const cs=await tx.get(db.doc(`clubs/${clubId}`));clubOk=cs.exists&&(cs.data().status||'approved')==='approved'}
   if(ev.status!=='published')throw E('failed-precondition','This event is not open for registration.');
   if(now()>=closeAtOf(ev))throw E('failed-precondition','Registration for this event has closed.');
   if(ev.format==='Team'&&teamName&&(teamName.length<2||teamName.length>40))throw E('invalid-argument','A team name needs 2 to 40 characters. You can also leave it empty.');   // the team name is optional
   if(!clubOk)throw E('invalid-argument','Choose a club from the list, or Independent.');
   const old=regSnap.exists?regSnap.data():null;
   if(old&&HOLDING.includes(old.status))throw E('already-exists','You are already registered for this event.');
   if(old&&['Disqualified','Declined'].includes(old.status))throw E('permission-denied','The organiser has closed your registration for this event.');
   const c=countsOf(ev),status=c.accepted<ev.limit?'Accepted':'Waitlist',order=c.seq+1;
   if(status==='Accepted')c.accepted++;else c.waitlist++;
   c.seq=order;
   reg={uid:me.uid,name,status,teamName:ev.format==='Team'?teamName:'',clubId,order,confirmed:false};
   tx.set(db.doc(P.reg(eventId,me.uid)),{...reg,createdAt:ts(),updatedAt:ts()});
   tx.set(db.doc(P.priv(eventId,me.uid)),{uid:me.uid,phone,email:me.email,updatedAt:ts()});
   tx.set(db.doc(P.mine(me.uid,eventId)),{eventId,status,order,confirmed:false,createdAt:ts(),updatedAt:ts()});
   tx.update(db.doc(P.ev(eventId)),{counts:c});
   notes.push({to:me.email,...(status==='Accepted'?mails.registered(ev,site()):mails.waitlisted(ev,site()))});
   return {status,order,waitlistPosition:status==='Waitlist'?c.waitlist:0};
  });
  const oe=await ownerEmail(ev);if(oe&&ev.ownerId!==me.uid)notes.push({to:oe,...mails.organiserNew(ev,reg,site())});
  await send(notes);
  return out;
 };
 const cancelRegistration=async req=>{
  const me=await who(req),eventId=String((req.data||{}).eventId||'');
  const notes=[];
  await db.runTransaction(async tx=>{
   notes.length=0;
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists)throw E('not-found','That event does not exist.');
   const ev=evSnap.data(),regSnap=await tx.get(db.doc(P.reg(eventId,me.uid)));
   if(!regSnap.exists||!HOLDING.includes(regSnap.data().status))throw E('failed-precondition','You do not have an active registration for this event.');
   const old=regSnap.data();
   if(old.status==='On site')throw E('failed-precondition','You are already checked in. Ask the organiser to change your registration.');
   if(now()>=toDate(ev.startsAt))throw E('failed-precondition','The event has already started.');
   const c=countsOf(ev),wasActive=isActive(old.status);
   if(wasActive)c.accepted--;else c.waitlist--;
   const promos=wasActive?await waitlistFor(tx,eventId,ev.limit-c.accepted,me.uid):[];
   tx.update(db.doc(P.reg(eventId,me.uid)),{status:'Cancelled',updatedAt:ts()});
   tx.set(db.doc(P.mine(me.uid,eventId)),{status:'Cancelled',updatedAt:ts()},{merge:true});
   promote(tx,eventId,ev,c,promos,notes);
   tx.update(db.doc(P.ev(eventId)),{counts:c});
   notes.push({to:me.email,...mails.cancelled(ev,site())});
  });
  await send(notes);
  return {status:'Cancelled'};
 };
 const confirmAttendance=async req=>{
  const me=await who(req),eventId=String((req.data||{}).eventId||'');
  await db.runTransaction(async tx=>{
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists)throw E('not-found','That event does not exist.');
   const regSnap=await tx.get(db.doc(P.reg(eventId,me.uid)));
   if(!regSnap.exists||regSnap.data().status!=='Accepted')throw E('failed-precondition','Only people with an accepted registration can confirm.');
   if(now()>=toDate(evSnap.data().startsAt))throw E('failed-precondition','The event has already started.');
   tx.update(db.doc(P.reg(eventId,me.uid)),{confirmed:true,updatedAt:ts()});
   tx.set(db.doc(P.mine(me.uid,eventId)),{confirmed:true,updatedAt:ts()},{merge:true});
  });
  return {confirmed:true};
 };
 // The organiser (or an admin) changes someone's status. Freed spots go to the waitlist automatically.
 const setRegistrationStatus=async req=>{
  const me=await who(req),{eventId,uid,status}=req.data||{};
  if(!eventId||!uid)throw E('invalid-argument','Choose an event and a person.');
  if(!ORGANISER_STATUSES.includes(status))throw E('invalid-argument','Unknown status.');
  const notes=[];
  const out=await db.runTransaction(async tx=>{
   notes.length=0;
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists)throw E('not-found','That event does not exist.');
   const ev=evSnap.data();
   if(ev.ownerId!==me.uid&&!ADMINS.includes(me.role))throw E('permission-denied','Only the organiser or an admin can change registrations.');
   const regSnap=await tx.get(db.doc(P.reg(eventId,uid)));
   if(!regSnap.exists)throw E('not-found','That person is not registered.');
   const old=regSnap.data().status;
   if(old==='Cancelled')throw E('failed-precondition','This person cancelled their registration.');
   if(old===status)return {status};
   if(status==='On site'&&old!=='Accepted')throw E('failed-precondition','Accept this person before marking them on site.');
   const c=countsOf(ev);
   if(isActive(status)&&!isActive(old)&&c.accepted>=ev.limit)throw E('failed-precondition','No spots left. Raise the limit or move someone off the list first.');
   const priv=await tx.get(db.doc(P.priv(eventId,uid))),email=priv.exists?priv.data().email:'';
   if(isActive(old))c.accepted--;else if(old==='Waitlist')c.waitlist--;
   let order=regSnap.data().order;
   if(isActive(status))c.accepted++;else if(status==='Waitlist'){c.waitlist++;if(old!=='Waitlist'){c.seq++;order=c.seq}}
   const promos=isActive(old)&&!isActive(status)?await waitlistFor(tx,eventId,ev.limit-c.accepted,uid):[];
   // A waitlist only makes sense when the event is full.
   if(status==='Waitlist'&&c.accepted+promos.length<ev.limit)throw E('failed-precondition','There is a free spot, so there is no waitlist. Accept this person instead.');
   tx.update(db.doc(P.reg(eventId,uid)),{status,order,updatedAt:ts()});
   tx.set(db.doc(P.mine(uid,eventId)),{status,order,updatedAt:ts()},{merge:true});
   promote(tx,eventId,ev,c,promos,notes);
   tx.update(db.doc(P.ev(eventId)),{counts:c});
   const m=status==='Accepted'&&old==='Waitlist'?mails.promoted:status==='Declined'?mails.declined:status==='Disqualified'?mails.disqualified:status==='Waitlist'?mails.movedToWaitlist:null;
   if(m)notes.push({to:email,...m(ev,site())});
   return {status};
  });
  await send(notes);
  return out;
 };
 // Called when an event is edited: a higher limit lets people come off the waitlist.
 const fillSpots=async eventId=>{
  const notes=[];let moved=0;
  await db.runTransaction(async tx=>{
   notes.length=0;moved=0;
   const evSnap=await tx.get(db.doc(P.ev(eventId)));
   if(!evSnap.exists||evSnap.data().status!=='published')return;
   const ev=evSnap.data(),c=countsOf(ev),promos=await waitlistFor(tx,eventId,ev.limit-c.accepted,null);
   if(!promos.length)return;
   promote(tx,eventId,ev,c,promos,notes);moved=promos.length;
   tx.update(db.doc(P.ev(eventId)),{counts:c});
  });
  await send(notes);
  return moved;
 };
 // Daily: remind accepted people whose event starts in 2 to 3 days.
 const remind=async()=>{
  const t=now().getTime(),from=t+48*3600e3,to=t+72*3600e3;let sent=0;
  const evs=(await db.collection('events').where('status','==','published').get()).docs;
  for(const e of evs){
   const ev=e.data(),start=ev.startsAt?toDate(ev.startsAt).getTime():0;
   if(start<from||start>=to)continue;
   const regs=(await db.collection(P.regs(e.id)).where('status','==','Accepted').get()).docs;
   for(const r of regs){
    if(r.data().reminderSentAt)continue;
    const p=await db.doc(P.priv(e.id,r.id)).get(),email=p.exists?p.data().email:'';
    if(email){await send([{to:email,...mails.reminder(ev,site())}]);sent++}
    await db.doc(P.reg(e.id,r.id)).update({reminderSentAt:ts()});
   }
  }
  return sent;
 };
 return {registerForEvent,cancelRegistration,confirmAttendance,setRegistrationStatus,fillSpots,remind};
};
