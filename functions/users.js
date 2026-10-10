const {HttpsError}=require('firebase-functions/v2/https');
const ROLES=['participant','organiser','admin','superadmin'];
const rank=r=>Math.max(0,ROLES.indexOf(r));
const roleOf=u=>u.customClaims?.role||'participant';
// Handlers take the Auth and Firestore instances so they can be unit-tested with fakes.
exports.makeHandlers=(auth,db)=>{
 const caller=async req=>{
  if(!req.auth)throw new HttpsError('unauthenticated','Sign in first.');
  const u=await auth.getUser(req.auth.uid);
  const role=roleOf(u);
  if(u.disabled||rank(role)<2)throw new HttpsError('permission-denied','Admins only.');
  return {uid:u.uid,role};
 };
 const listUsers=async req=>{
  await caller(req);
  const users=[];let token;
  do{
   const r=await auth.listUsers(1000,token);
   for(const u of r.users)users.push({uid:u.uid,email:u.email||'',name:u.displayName||'',photo:u.photoURL||'',providers:(u.providerData||[]).map(p=>p.providerId),disabled:!!u.disabled,verified:!!u.emailVerified,created:u.metadata?.creationTime||'',lastSignIn:u.metadata?.lastSignInTime||'',role:roleOf(u)});
   token=r.pageToken;
  }while(token&&users.length<5000);
  return {users};
 };
 // Admins can manage participants/organisers; only superadmins can touch admins and superadmins.
 const updateUser=async req=>{
  const me=await caller(req);
  const {uid,role,disabled}=req.data||{};
  if(typeof uid!=='string'||!uid)throw new HttpsError('invalid-argument','A user is required.');
  if(role!==undefined&&!ROLES.includes(role))throw new HttpsError('invalid-argument','Unknown role.');
  if(disabled!==undefined&&typeof disabled!=='boolean')throw new HttpsError('invalid-argument','Invalid status.');
  if(uid===me.uid)throw new HttpsError('failed-precondition','You cannot change your own role or status.');
  let target;
  try{target=await auth.getUser(uid)}catch{throw new HttpsError('not-found','User not found.')}
  const cur=roleOf(target);
  if(me.role!=='superadmin'&&(rank(cur)>1||(role!==undefined&&rank(role)>1)))throw new HttpsError('permission-denied','Only a superadmin can manage admins.');
  const newRole=role??cur,newOff=disabled??!!target.disabled;
  if(newRole!==cur)await auth.setCustomUserClaims(uid,{role:newRole});
  if(newOff!==!!target.disabled)await auth.updateUser(uid,{disabled:newOff});
  if((newOff&&!target.disabled)||rank(newRole)<rank(cur))await auth.revokeRefreshTokens(uid);
  await db.doc(`users/${uid}`).set({role:newRole,disabled:newOff},{merge:true});
  return {uid,role:newRole,disabled:newOff};
 };
 return {listUsers,updateUser};
};
