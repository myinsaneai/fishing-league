export const DISC=['Fly','Spin','Surfcasting','Boat','Kayak','Other'];
export const REGIONS=['Northland','Auckland','Waikato','Bay of Plenty','Wellington','Canterbury','Otago'];
export const SPECIES=['Rainbow trout','Brown trout','Snapper','Kahawai','Kingfish','Other'];
export const CLUBS=[{id:'c1',name:'Wellington Anglers'},{id:'c2',name:'Taupō Fly Club'},{id:'c3',name:'Canterbury Surfcasters'}];
export const ORGS={o1:'Olivia Organiser',o2:'Chris Coordinator'};
export const USERS={participant:{id:'u1',name:'Alex Angler',role:'participant',clubs:['c1']},organiser:{id:'o1',name:'Olivia Organiser',role:'organiser',clubs:['c2']},admin:{id:'a1',name:'Sam Admin',role:'admin',clubs:[]}};
const d=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
export const EVENTS=[
{id:'e1',name:'Taupō Fly Open',date:d(21),waterbody:'Lake Taupō',region:'Waikato',disc:'Fly',format:'Individual',limit:3,club:'c2',org:'o1',fee:20},
{id:'e2',name:'Harbour Spin Cup',date:d(10),waterbody:'Wellington Harbour',region:'Wellington',disc:'Spin',format:'Team',limit:2,club:'c1',org:'o1',fee:30},
{id:'e3',name:'Raglan Surf Day',date:d(2),waterbody:'Ruapuke Beach',region:'Waikato',disc:'Surfcasting',format:'Individual',limit:20,club:'c3',org:'o2',fee:15},
{id:'e4',name:'Bay Boat Classic',date:d(35),waterbody:'Bay of Islands',region:'Northland',disc:'Boat',format:'Team',limit:12,club:'c3',org:'o2',fee:60},
{id:'e5',name:'Family Fishing Day',date:d(28),waterbody:'Lake Rotoiti',region:'Bay of Plenty',disc:'Other',otherLabel:'Family day',format:'Individual',limit:40,club:'c2',org:'o1',fee:0},
{id:'e6',name:'Autumn Kayak Challenge',date:d(-20),waterbody:'Otago Harbour',region:'Otago',disc:'Kayak',format:'Individual',limit:15,club:'c1',org:'o2',fee:25}];
export const REGS=[
{id:'r1',eventId:'e1',userId:'x1',name:'Jamie Rod',status:'Accepted'},{id:'r2',eventId:'e1',userId:'x2',name:'Sam Reel',status:'Accepted'},
{id:'r3',eventId:'e2',userId:'x1',name:'Jamie Rod',status:'Accepted'},{id:'r4',eventId:'e2',userId:'x3',name:'Kai Line',status:'Accepted'},{id:'r5',eventId:'e2',userId:'x2',name:'Sam Reel',status:'Waitlist'},
{id:'r6',eventId:'e3',userId:'u1',name:'Alex Angler',status:'Accepted'},{id:'r7',eventId:'e3',userId:'x3',name:'Kai Line',status:'Accepted'},{id:'r8',eventId:'e6',userId:'u1',name:'Alex Angler',status:'On site'}];
export const ACTIVE=['Accepted','On site'];
export const isPast=e=>e.date<new Date().toISOString().slice(0,10);
export const status=(e,taken)=>isPast(e)?'Finished':taken>=e.limit?'Waitlist':'Registration open';
export const daysTo=e=>Math.ceil((new Date(e.date)-Date.now())/864e5);
export const fmt=e=>new Date(e.date).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});
export const discLabel=e=>e.disc==='Other'?`Other · ${e.otherLabel||'Other'}`:e.disc;
