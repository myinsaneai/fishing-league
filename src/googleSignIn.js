// Google sign-in through Google Identity Services (GIS), handed to Firebase with signInWithCredential.
// Why not Firebase's own popup: it finishes on https://<authDomain>/__/auth/handler and needs a Firebase helper iframe.
// On Android an installed copy of the app can grab that address (a white page / "missing initial state"), and Chrome's
// ad filter can block the helper iframe on a flagged site. With GIS the popup lives on accounts.google.com and answers
// the page with a message, so nothing has to come back to our own address.
// The client ID is public (it is not a secret): the "Web client (auto created by Google Service)" of the Firebase project.
// Its "Authorized JavaScript origins" in Google Cloud must list every address the site is opened from.
const CLIENT_ID=import.meta.env.VITE_GOOGLE_CLIENT_ID||'655530575506-0d4m2g8e0g1ohmgohj4ek1lvm4msbtke.apps.googleusercontent.com';
const SRC='https://accounts.google.com/gsi/client';
export const gisReady=()=>typeof window!=='undefined'&&!!window.google?.accounts?.oauth2?.initTokenClient;
// Load the Google script ahead of time: the popup must be opened straight from the tap, so there is no time to load it then.
export function preloadGis(){
 if(typeof document==='undefined'||gisReady()||document.querySelector(`script[src="${SRC}"]`))return;
 const s=document.createElement('script');s.src=SRC;s.async=true;s.defer=true;document.head.appendChild(s);
}
// Opens Google's account chooser and resolves with an access token. Call it directly from a click handler, and only when gisReady().
export function requestGoogleAccessToken(){
 return new Promise((resolve,reject)=>{
  const fail=(code,message)=>reject(Object.assign(new Error(message),{code}));
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:CLIENT_ID,scope:'openid email profile',
   callback:r=>r?.access_token?resolve(r.access_token):fail('gis/'+(r?.error||'no_token'),r?.error_description||'Google did not return a sign-in token.'),
   error_callback:e=>fail('gis/'+(e?.type||'error'),e?.message||'Google sign-in failed.')});
  client.requestAccessToken({prompt:'select_account'});
 });
}
