const {onCall}=require('firebase-functions/v2/https');
const {onDocumentUpdated}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineString}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {makeHandlers}=require('./users');
const {getStorage}=require('firebase-admin/storage');
const {makeRegistration}=require('./registration');
const {makeEvidence}=require('./evidence');
const {makeDeletion}=require('./deletion');
initializeApp();
// Firestore is in nam5 (US), so the functions run in us-central1 next to it: each registration makes several
// database calls, and across the Pacific every one of them would add a couple of hundred milliseconds.
const REGION='us-central1';
const SITE_URL=defineString('SITE_URL',{default:'https://fishingleague.co.nz'});
const db=getFirestore();
const h=makeHandlers(getAuth(),db);
exports.listUsers=onCall({region:REGION},h.listUsers);
exports.updateUser=onCall({region:REGION},h.updateUser);
// Emails are written to the "mail" collection; the "Trigger Email from Firestore" extension sends them.
const reg=makeRegistration({auth:getAuth(),db,ts:()=>FieldValue.serverTimestamp(),siteUrl:()=>SITE_URL.value(),
 mail:n=>db.collection('mail').add({to:n.to,message:{subject:n.subject,text:n.text}})});
exports.registerForEvent=onCall({region:REGION},reg.registerForEvent);
exports.cancelRegistration=onCall({region:REGION},reg.cancelRegistration);
exports.confirmAttendance=onCall({region:REGION},reg.confirmAttendance);
exports.setRegistrationStatus=onCall({region:REGION},reg.setRegistrationStatus);
// Evidence photos: the browser uploads the photo to Storage, then these functions make and review the record.
const evi=makeEvidence({auth:getAuth(),db,ts:()=>FieldValue.serverTimestamp(),
 files:{meta:async path=>{try{const [m]=await getStorage().bucket().file(path).getMetadata();return {size:m.size,contentType:m.contentType}}catch(e){if(e.code===404)return null;throw e}}}});
exports.submitEvidence=onCall({region:REGION},evi.submitEvidence);
exports.reviewEvidence=onCall({region:REGION},evi.reviewEvidence);
// Permanent deletion of clubs, events and users with everything that belongs to them (admins only). It runs here, not in the browser,
// because it also has to clean up registrations, evidence, pictures and the spot counts of other events.
const bucket=()=>getStorage().bucket();
const del=makeDeletion({auth:getAuth(),db,fillSpots:reg.fillSpots,purge:ref=>db.recursiveDelete(ref),
 files:{list:async prefix=>(await bucket().getFiles({prefix}))[0].map(f=>f.name),
  removePrefix:async prefix=>{await bucket().deleteFiles({prefix,force:true})},
  remove:async path=>{await bucket().file(path).delete({ignoreNotFound:true})}}});
const LONG={region:REGION,timeoutSeconds:300};
exports.deleteClub=onCall(LONG,del.deleteClub);
exports.deleteEvent=onCall(LONG,del.deleteEvent);
exports.deleteUser=onCall(LONG,del.deleteUser);
// A higher limit (or an event being published) lets people move up from the waitlist.
exports.onEventUpdated=onDocumentUpdated({document:'events/{eventId}',region:REGION},async event=>{
 const b=event.data.before.data(),a=event.data.after.data();
 if(a.status==='published'&&(a.limit>b.limit||b.status!=='published'))await reg.fillSpots(event.params.eventId);
});
exports.sendReminders=onSchedule({schedule:'every day 08:00',timeZone:'Pacific/Auckland',region:REGION},async()=>{await reg.remind()});
