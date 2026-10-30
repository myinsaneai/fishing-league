// Plain-text emails. They are queued in the "mail" collection and sent by the sendQueuedMail function (functions/mailer.js).
const toDate=x=>x?.toDate?x.toDate():new Date(x);
const fmt=d=>d.toLocaleString('en-NZ',{timeZone:'Pacific/Auckland',weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
const when=ev=>ev.endsAt?`${fmt(toDate(ev.startsAt))} to ${fmt(toDate(ev.endsAt))}`:fmt(toDate(ev.startsAt));
const where=ev=>[ev.waterbody,ev.district,ev.region].filter(Boolean).join(', ');
const details=ev=>`${ev.name}\nWhen: ${when(ev)}\nWhere: ${where(ev)}${ev.meetingPoint?`\nMeeting point: ${ev.meetingPoint}`:''}`;
const sign='\n\nFishing League';
exports.mails={
 // Organiser role requests (not tied to an event).
 organiserRequested:(r,site)=>({subject:`New organiser request: ${r.name}`,text:`Hi,\n\n${r.name} (${r.email}) would like to become an organiser:\n\n${r.reason}\n\nApprove or decline it on the Admin page, Approvals, Organisers: ${site}/admin${sign}`}),
 organiserApproved:(r,site)=>({subject:'You can now organise events',text:`Hi${r.name?' '+r.name:''},\n\nAn admin has approved your request. You can now create events and manage registrations from Manage: ${site}/manage\n\nIf you do not see Manage in the menu yet, sign out and sign in again.${sign}`}),
 organiserDeclined:(r,site)=>({subject:'About your organiser request',text:`Hi${r.name?' '+r.name:''},\n\nAn admin has declined your request to become an organiser.\n\nReason: ${r.note}\n\nYou can send a new request from My page: ${site}/me${sign}`}),
 registered:(ev,site)=>({subject:`You're registered: ${ev.name}`,text:`Hi,\n\nYou are registered for ${details(ev)}\n\nYou can see or cancel your registration on My page: ${site}/me${sign}`}),
 waitlisted:(ev,site)=>({subject:`You're on the waitlist: ${ev.name}`,text:`Hi,\n\nThe event is full, so you are on the waitlist for ${details(ev)}\n\nIf a spot opens up you will move up automatically and we will email you. You can cancel on My page: ${site}/me${sign}`}),
 promoted:(ev,site)=>({subject:`A spot opened up: ${ev.name}`,text:`Good news,\n\nA spot has opened up and you are now registered for ${details(ev)}\n\nIf you can no longer come, please cancel on My page so the next person can have your spot: ${site}/me${sign}`}),
 cancelled:(ev,site)=>({subject:`Registration cancelled: ${ev.name}`,text:`Hi,\n\nYour registration for ${ev.name} has been cancelled.${sign}`}),
 declined:(ev,site)=>({subject:`Registration not accepted: ${ev.name}`,text:`Hi,\n\nThe organiser was not able to accept your registration for ${ev.name}. Please contact the organiser if you have questions.${sign}`}),
 disqualified:(ev,site)=>({subject:`Registration cancelled by the organiser: ${ev.name}`,text:`Hi,\n\nThe organiser has cancelled your registration for ${ev.name}. Please contact the organiser if you have questions.${sign}`}),
 movedToWaitlist:(ev,site)=>({subject:`Moved to the waitlist: ${ev.name}`,text:`Hi,\n\nThe organiser has moved you to the waitlist for ${ev.name}. We will email you if a spot opens up.${sign}`}),
 organiserNew:(ev,reg,site)=>({subject:`New registration (${reg.status}): ${ev.name}`,text:`${reg.name} has registered for ${ev.name} and is ${reg.status==='Waitlist'?'on the waitlist':'accepted'}.${reg.teamName?`\nTeam: ${reg.teamName}`:''}\n\nSee all registrations: ${site}/manage${sign}`}),
 reminder:(ev,site)=>({subject:`Reminder: ${ev.name} is coming up`,text:`Hi,\n\nA reminder that you are registered for ${details(ev)}\n\nPlease confirm that you are coming, or cancel if you cannot make it, on My page: ${site}/me${sign}`})};
