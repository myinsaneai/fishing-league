const crypto=require('crypto');
const {mails}=require('./emails');
const ROLES=['participant','organiser','admin','superadmin'];
const rank=r=>Math.max(0,ROLES.indexOf(r));
const roleOf=u=>u.customClaims?.role||'participant';
// Tells the admins when a club or an event is waiting for approval: when it is created as pending, when a draft is submitted,
// and when a rejected item is sent in again. Triggered by Firestore (the browser writes clubs and events directly).
// before/after are the document data (null when it did not exist / no longer exists); eventId is the trigger's own id, so a
// duplicate delivery of the same trigger makes the same mail ids and sends nothing twice.
exports.makeApprovalAlerts=({auth,mail=async()=>{},siteUrl=()=>''})=>{
 const site=()=>String(siteUrl()||'').trim().replace(/\/+$/,'');
 const admins=async()=>{
  const out=[];let token;
  do{const r=await auth.listUsers(1000,token);for(const u of r.users)if(!u.disabled&&u.email&&rank(roleOf(u))>=2)out.push(u.email);token=r.pageToken}while(token&&out.length<200);
  return out;
 };
 const waiting=(before,after)=>!!after&&after.status==='pending'&&(!before||before.status!=='pending');
 const notify=async(kind,eventId,before,after,make)=>{
  if(!waiting(before,after))return 0;
  const again=before?.status==='rejected';
  let sent=0;
  try{
   for(const to of await admins()){
    const id=`approval-${kind}-${eventId}-${crypto.createHash('sha1').update(to).digest('hex').slice(0,12)}`;
    try{await mail({id,to,...make(after,site(),again)});sent++}catch(e){console.warn('mail',e.message)}   // one failed email must not stop the others
   }
  }catch(e){console.warn('approval alert',e.message)}
  return sent;
 };
 return {
  clubWritten:({eventId,before,after})=>notify('club',eventId,before,after,mails.clubPending),
  eventWritten:({eventId,before,after})=>notify('event',eventId,before,after,mails.eventPending),
 };
};
