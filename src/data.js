export const DISC=['Fly','Spin','Surfcasting','Boat','Kayak','Other'];
export const REGIONS=['Northland','Auckland','Waikato','Bay of Plenty','Gisborne',"Hawke's Bay",'Taranaki','Manawatū-Whanganui','Wellington','Tasman','Nelson','Marlborough','West Coast','Canterbury','Otago','Southland','Chatham Islands'];
// Districts and well-known fishing areas inside each region (edit freely).
export const DISTRICTS={
 'Northland':['Far North','Whangārei','Kaipara'],
 'Auckland':[],
 'Waikato':['Taupō','Thames-Coromandel','Hauraki','Waikato','Matamata-Piako','Hamilton City','Waipā','Ōtorohanga','South Waikato','Waitomo'],
 'Bay of Plenty':['Rotorua Lakes','Western Bay of Plenty','Tauranga','Whakatāne','Ōpōtiki','Kawerau'],
 'Gisborne':['Gisborne'],
 "Hawke's Bay":['Napier','Hastings','Wairoa',"Central Hawke's Bay"],
 'Taranaki':['New Plymouth','Stratford','South Taranaki'],
 'Manawatū-Whanganui':['Ruapehu','Whanganui','Rangitīkei','Manawatū','Palmerston North','Tararua','Horowhenua'],
 'Wellington':['Wellington City','Lower Hutt','Upper Hutt','Porirua','Kāpiti Coast','Masterton','Carterton','South Wairarapa'],
 'Tasman':['Tasman','Golden Bay'],
 'Nelson':['Nelson'],
 'Marlborough':['Marlborough Sounds','Blenheim'],
 'West Coast':['Buller','Grey','Westland'],
 'Canterbury':['Kaikōura','Hurunui','Waimakariri','Christchurch City','Selwyn','Ashburton','Timaru','Mackenzie','Waimate','Waitaki'],
 'Otago':['Queenstown-Lakes','Central Otago','Dunedin City','Clutha','Waitaki'],
 'Southland':['Fiordland','Stewart Island / Rakiura','Southland','Gore','Invercargill'],
 'Chatham Islands':[]};
// Suggestions for the waterbody field (people can type anything).
export const NZ_WATERS=['Lake Taupō','Lake Rotorua','Lake Rotoiti','Lake Tarawera','Lake Waikaremoana','Lake Brunner','Lake Wānaka','Lake Wakatipu','Lake Benmore','Lake Pūkaki','Lake Tekapo','Tongariro River','Whanganui River','Waikato River','Rangitīkei River','Rakaia River','Rangitata River','Waitaki River','Buller River','Mataura River','Clutha River','Hauraki Gulf','Bay of Islands','Manukau Harbour','Raglan Harbour','Kāwhia Harbour','Ninety Mile Beach','Hawke Bay','Cook Strait','Wellington Harbour','Marlborough Sounds','Golden Bay','Kaikōura coast','Otago Harbour','Foveaux Strait','Fiordland'];
export const SPECIES=['Rainbow trout','Brown trout','Snapper','Kahawai','Kingfish','Other'];
export const USERS={participant:{id:'u1',name:'Alex Angler',role:'participant',clubs:['c1']},organiser:{id:'o1',name:'Olivia Organiser',role:'organiser',clubs:['c2']},admin:{id:'a1',name:'Sam Admin',role:'admin',clubs:[]}};
export const ACTIVE=['Accepted','On site'];
const TZ='Pacific/Auckland';
export const nzDate=d=>d.toLocaleDateString('en-CA',{timeZone:TZ});
// An event is finished once its end has passed (or, with no end set, once its start date has passed).
export const isPast=e=>e.endsAt?e.endsAt<new Date():(!!e.date&&e.date<nzDate(new Date()));
export const isLive=e=>!!e.startsAt&&!!e.endsAt&&e.startsAt<=new Date()&&new Date()<e.endsAt;
export const status=(e,taken)=>e.status==='cancelled'?'Cancelled':e.status==='draft'?'Draft':e.status==='pending'?'Pending approval':e.status==='rejected'?'Rejected':isPast(e)?'Finished':isLive(e)&&e.registrationCloses!=='end'?'In progress':taken>=e.limit?'Waitlist':'Registration open';
export const daysTo=e=>Math.ceil(((e.startsAt||new Date(e.date))-Date.now())/864e5);
export const fmt=e=>(e.startsAt||new Date(e.date)).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric',timeZone:e.startsAt?TZ:'UTC'});
export const fmtTime=e=>e.startsAt?e.startsAt.toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit',timeZone:TZ}):'';
export const discLabel=e=>e.disc==='Other'?`Other · ${e.otherLabel||'Other'}`:e.disc;
export const WATER=[{v:'All',l:'All waters'},{v:'Sea',l:'Sea fishing'},{v:'Freshwater',l:'Freshwater fishing'}];
export const waterLabel=e=>e.water==='Sea'?'Sea fishing':'Freshwater fishing';
const dateIn=d=>d.toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric',timeZone:TZ});
const timeIn=d=>d.toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit',timeZone:TZ});
const sameDay=e=>nzDate(e.startsAt)===nzDate(e.endsAt);
// "12 Oct 2026, 9:00 am – 3:30 pm", or with both dates when the event runs over more than one day.
export const fmtRange=e=>{
 if(!e.startsAt)return fmt(e);
 const s=`${dateIn(e.startsAt)}, ${timeIn(e.startsAt)}`;
 if(!e.endsAt)return s;
 return sameDay(e)?`${s} – ${timeIn(e.endsAt)}`:`${s} – ${dateIn(e.endsAt)}, ${timeIn(e.endsAt)}`;
};
// Just the days: "12 Oct 2026" or "12 Oct 2026 – 14 Oct 2026".
export const fmtDays=e=>!e.startsAt||!e.endsAt||sameDay(e)?fmt(e):`${dateIn(e.startsAt)} – ${dateIn(e.endsAt)}`;
export const EVENT_KINDS=[{v:'tournament',l:'Tournament'},{v:'seminar',l:'Seminar'}];
export const kindLabel=e=>e.kind==='seminar'?'Seminar':'Tournament';
// Registration closes when the event starts (the default) or, if the organiser chose so, when it ends.
export const closeAt=e=>e.registrationCloses==='end'&&e.endsAt?e.endsAt:(e.startsAt||(e.date?new Date(e.date+'T23:59:59Z'):new Date(0)));
export const registrationOpen=(e,now=new Date())=>e.status==='published'&&now<closeAt(e);
export const regCloseText=e=>`${dateIn(closeAt(e))}, ${timeIn(closeAt(e))} (${e.registrationCloses==='end'&&e.endsAt?'when the event ends':'when the event starts'})`;
