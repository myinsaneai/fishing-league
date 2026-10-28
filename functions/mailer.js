// Sends the emails the app queues in the "mail" collection ({to, message:{subject, text}}), through an SMTP server (Brevo).
// This replaces the Firebase "Trigger Email" extension, because Firebase Extensions is being shut down (March 2027).
// The result is written back to the document as `delivery`, in the same shape the extension used:
//   {state: PROCESSING | SUCCESS | ERROR, attempts, startTime, endTime, error, info:{messageId, accepted, rejected, response}}
// Only the app's functions can write to "mail" (the Firestore rules give the browser no access), so the sender and the
// reply-to address are fixed settings here, never taken from the document.
const EMAIL=/^[^\s<>()[\]\\,;:"@]+@[^\s<>()[\]\\,;:"@]+\.[^\s<>()[\]\\,;:"@]+$/;   // plain addresses only: no names, quotes or lists
const MAX_RECIPIENTS=10,MAX_ATTEMPTS=3,WAITS=[1000,3000];
const TRANSIENT=['ECONNECTION','ETIMEDOUT','ESOCKET','ECONNRESET','EDNS'];
const cut=(s,n=400)=>String(s??'').slice(0,n);
const strs=a=>(Array.isArray(a)?a:[]).map(String);
exports.EMAIL=EMAIL;
// getTransport() gives an object with sendMail(options) (nodemailer); it is created when needed because the SMTP password is a runtime secret.
exports.makeMailer=({db,ts,getTransport,from,replyTo=()=>'',sleep=ms=>new Promise(r=>setTimeout(r,ms))})=>{
 const check=d=>{
  const to=(Array.isArray(d.to)?d.to:[d.to]).map(x=>String(x??'').trim()).filter(Boolean);
  if(!to.length||to.length>MAX_RECIPIENTS||!to.every(a=>EMAIL.test(a)))return {error:'Invalid recipient address.'};
  const m=d.message||{},subject=typeof m.subject==='string'?m.subject.trim():'';
  if(!subject||subject.length>200)return {error:'The email needs a subject (up to 200 characters).'};
  if(!(typeof m.text==='string'&&m.text.trim())&&!(typeof m.html==='string'&&m.html.trim()))return {error:'The email has no text.'};
  return {to,subject,text:typeof m.text==='string'?m.text:undefined,html:typeof m.html==='string'?m.html:undefined};
 };
 const send=async ref=>{
  // Cloud Functions can deliver the same event twice: only the first run may send.
  let data=null;
  const mine=await db.runTransaction(async tx=>{
   const s=await tx.get(ref);
   if(!s.exists)return false;
   data=s.data();
   if(data.delivery)return false;
   tx.update(ref,{delivery:{state:'PROCESSING',attempts:0,startTime:ts(),endTime:null,error:null,info:null}});
   return true;
  });
  if(!mine)return 'skipped';
  const startTime=ts(),fail=(attempts,error)=>ref.update({delivery:{state:'ERROR',attempts,startTime,endTime:ts(),error:cut(error),info:null}});
  const ok=check(data);
  if(ok.error){await fail(0,ok.error);return 'error'}
  const options={from:from(),to:ok.to,subject:ok.subject,text:ok.text,html:ok.html};
  if(replyTo())options.replyTo=replyTo();
  let last=null,attempts=0;
  while(attempts<MAX_ATTEMPTS){
   attempts++;
   try{
    const r=await getTransport().sendMail(options),accepted=strs(r.accepted),rejected=strs(r.rejected);
    if(!accepted.length&&rejected.length){await fail(attempts,'All recipients were rejected.');return 'error'}
    await ref.update({delivery:{state:'SUCCESS',attempts,startTime,endTime:ts(),error:null,info:{messageId:cut(r.messageId,200),accepted,rejected,response:cut(r.response,300)}}});
    return 'sent';
   }catch(e){
    last=e;
    const transient=TRANSIENT.includes(e.code)||(e.responseCode>=400&&e.responseCode<500);
    if(!transient||attempts>=MAX_ATTEMPTS)break;
    await sleep(WAITS[attempts-1]??WAITS[WAITS.length-1]);
   }
  }
  await fail(attempts,last?.message||'Sending failed.');
  return 'error';
 };
 return {send};
};
