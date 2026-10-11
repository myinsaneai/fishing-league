// Explains an item's approval state to its owner and to admins.
export default function Banner({item,what}){
 if(item.status==='pending')return <div className="note" role="status"><b>Waiting for approval.</b> Only you and the admins can see this {what} until it is approved.</div>;
 if(item.status==='rejected')return <div className="note bad" role="status"><b>Not approved.</b> {item.rejectionReason||'No reason was given.'} Update the {what} and save to submit it again.</div>;
 if(item.status==='draft')return <div className="note" role="status"><b>Draft.</b> Only you and the admins can see this {what}.</div>;
 return null}
