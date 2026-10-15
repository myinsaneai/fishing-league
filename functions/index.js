const {onCall}=require('firebase-functions/v2/https');
const {onDocumentUpdated}=require('firebase-functions/v2/firestore');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineString}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {makeHandlers}=require('./users');
const {makeRegistration}=require('./registration');
initializeApp();
// Firestore is in nam5 (US), so the functions run in us-central1 next to it: each registration makes several
// database calls, and across the Pacific every one of them would add a couple of hundred milliseconds.
const REGION='us-central1';
const SITE_URL=defineString('SITE_URL',{default:'https://fishing-league-nz.web.app'});
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
// A higher limit (or an event being published) lets people move up from the waitlist.
exports.onEventUpdated=onDocumentUpdated({document:'events/{eventId}',region:REGION},async event=>{
 const b=event.data.before.data(),a=event.data.after.data();
 if(a.status==='published'&&(a.limit>b.limit||b.status!=='published'))await reg.fillSpots(event.params.eventId);
});
exports.sendReminders=onSchedule({schedule:'every day 08:00',timeZone:'Pacific/Auckland',region:REGION},async()=>{await reg.remind()});
