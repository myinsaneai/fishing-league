import {doc,serverTimestamp,updateDoc} from 'firebase/firestore';
import {db} from './firebase';
// Approve, reject or revoke a club or event. Only admins and superadmins are allowed to by the Firestore rules.
export const reviewItem=(kind,id,status,reason,user)=>updateDoc(doc(db,kind==='club'?'clubs':'events',id),{
 status,
 rejectionReason:status==='rejected'?String(reason||'').trim().slice(0,300):'',
 reviewedBy:user.id,reviewedByName:user.name,reviewedAt:serverTimestamp()});
