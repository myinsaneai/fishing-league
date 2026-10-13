import {useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useApp} from './store';
import {useClubs,isApprovedClub} from './clubsStore';
import {useEvents} from './eventsStore';
import ImageDrop from './ImageDrop';
import Banner from './Status';
import {MapField,parseMapInput,mapFields} from './maps';
import {nzParts,nzToDate,timeOptionsFor,suggestEnd} from './time';
import {DISC,REGIONS,DISTRICTS,NZ_WATERS} from './data';
const ADMINS=['admin','superadmin'];
export const WATER_TYPES=[{v:'Sea',l:'Sea fishing'},{v:'Freshwater',l:'Freshwater fishing'}];
const blank={name:'',description:'',waterType:'',discipline:'',disciplineOther:'',format:'Individual',region:'',district:'',waterbody:'',meetingPoint:'',startDate:'',startTime:'07:00',endDate:'',endTime:'',endTouched:false,map:'',fee:'0',limit:'30',clubId:'',status:'published'};
const fromEvent=e=>({...Object.fromEntries(Object.keys(blank).map(k=>[k,e[k]??blank[k]])),status:e.status==='rejected'?'pending':e.status,startDate:(e.startsAt?nzParts(e.startsAt):{date:''}).date,startTime:(e.startsAt?nzParts(e.startsAt):{time:'07:00'}).time,endDate:(e.endsAt?nzParts(e.endsAt):{date:''}).date,endTime:(e.endsAt?nzParts(e.endsAt):{time:''}).time,endTouched:!!e.endsAt,map:e.mapUrl||'',fee:String(e.fee??0),limit:String(e.limit??'')});
export function validateEvent(f,creating,now=new Date()){
 if(f.name.trim().length<3)return 'Give the event a name (at least 3 characters).';
 if(!f.waterType)return 'Choose Sea fishing or Freshwater fishing.';
 if(!f.discipline)return 'Choose a discipline.';
 if(f.discipline==='Other'&&!f.disciplineOther.trim())return 'Describe the discipline, for example “Spearfishing”.';
 if(!f.region)return 'Choose a region.';
 if(f.waterbody.trim().length<2)return 'Enter the waterbody or place.';
 const d=f.startDate&&f.startTime?nzToDate(f.startDate,f.startTime):null;
 if(!d||isNaN(d))return 'Choose the start date and time.';
 if(creating&&d<=now)return 'The start time must be in the future.';
 const end=f.endDate&&f.endTime?nzToDate(f.endDate,f.endTime):null;
 if(!end||isNaN(end))return 'Choose the end date and time.';
 if(end<=d)return 'The end must be after the start.';
 const fee=String(f.fee||'0');
 if(!/^\d{1,5}(\.\d{1,2})?$/.test(fee)||Number(fee)>10000)return 'Enter the entry fee in NZD, from 0 to 10000 (0 means free).';
 if(!/^\d{1,4}$/.test(String(f.limit))||Number(f.limit)<1||Number(f.limit)>2000)return 'The participant limit should be a whole number from 1 to 2000.';
 const mp=parseMapInput(f.map);if(mp.error)return mp.error;
 return '';
}
export const toEventData=f=>({name:f.name.trim(),description:f.description.trim(),waterType:f.waterType,discipline:f.discipline,disciplineOther:f.discipline==='Other'?f.disciplineOther.trim():'',format:f.format,region:f.region,district:f.district,waterbody:f.waterbody.trim(),meetingPoint:f.meetingPoint.trim(),startsAt:nzToDate(f.startDate,f.startTime),endsAt:nzToDate(f.endDate,f.endTime),...mapFields(f.map),fee:Number(f.fee||0),limit:Number(f.limit),clubId:f.clubId,status:f.status});
// Defined at module level on purpose: a component created inside another component is rebuilt on every render, which makes inputs lose focus.
const Field=({t,children})=><label className="m" style={{display:'grid',gap:4}}>{t}{children}</label>;
export function EventEditor(){
 const {id}=useParams(),nav=useNavigate(),{user}=useApp(),{clubs}=useClubs(),{events,loading,saveEvent}=useEvents(),ev=id?events.find(x=>x.id===id):null;
 const [f,setF]=useState(null),[img,setImg]=useState({}),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 if(id&&!ev)return loading?<p className="m">Loading…</p>:<div className="c"><p>Event not found.</p><Link to="/">Back to events</Link></div>;
 if(id&&!(ev.ownerId===user.id||ADMINS.includes(user.role)))return <div className="c"><p>Only the organiser who created this event, or an admin, can edit it.</p><Link to={'/event/'+id}>Back to the event</Link></div>;
 const staff=ADMINS.includes(user.role),form=f||(ev?fromEvent(ev):{...blank,status:staff?'published':'pending'}),set=k=>v=>setF({...form,[k]:v}),districts=DISTRICTS[form.region]||[];
 // Until the organiser sets an end themselves, it follows the start (four hours later).
 const setStart=(k,v)=>{const n={...form,[k]:v};if(!form.endTouched&&n.startDate&&n.startTime){const e=suggestEnd(n.startDate,n.startTime);n.endDate=e.date;n.endTime=e.time}setF(n)};
 const setEnd=(k,v)=>setF({...form,[k]:v,endTouched:true});
 const myClubs=clubs.filter(c=>isApprovedClub(c)&&(staff||c.ownerId===user.id||user.clubs.includes(c.id)));
 const cur=ev?.status,statusOpts=staff?[['published','Published (public)'],['pending','Pending approval'],['draft','Draft'],...(id?[['cancelled','Cancelled']]:[])]:(cur==='published'||cur==='cancelled')?[['published','Published (public)'],['cancelled','Cancelled']]:[['pending','Submit for approval'],['draft','Save as draft (only you and admins)']];
 const submit=async e=>{
  e.preventDefault();const m=validateEvent(form,!id);if(m){setErr(m);return}
  setBusy(true);setErr('');
  try{
   const r=await saveEvent({id,data:toEventData(form),file:img.file,removeImage:img.remove,user});
   if(r.imageError){setErr('The event was saved, but the photo upload failed: '+r.imageError);setBusy(false);if(!id)nav('/event/'+r.id+'/edit',{replace:true});return}
   nav('/event/'+r.id);
  }catch(x){setErr(x.message);setBusy(false)}
 };
 return <form className="form" onSubmit={submit} noValidate><h1>{id?'Edit event':'Create event'}</h1>{!staff&&!['published','cancelled'].includes(cur)&&<p className="note">Events are checked by an admin before they appear publicly.</p>}{ev&&<Banner item={ev} what="event"/>}
  <div className="c" style={{display:'grid',gap:12}}><b>Event photo</b><ImageDrop url={ev?.coverUrl} onChange={setImg}/></div>
  <div className="c" style={{display:'grid',gap:12}}><b>Basics</b>
   <Field t="Event name"><input className="f" maxLength={100} value={form.name} onChange={e=>set('name')(e.target.value)} required/></Field>
   <Field t={`Description and rules (${form.description.length}/2000)`}><textarea className="f" rows={6} maxLength={2000} value={form.description} onChange={e=>set('description')(e.target.value)}/></Field></div>
  <div className="c" style={{display:'grid',gap:12}}><b>When and where</b>
   <div className="cols"><Field t="Start date"><input className="f" type="date" min={id?undefined:nzParts(new Date()).date} value={form.startDate} onChange={e=>setStart('startDate',e.target.value)} required/></Field>
    <Field t="Start time (New Zealand time)"><select className="f" value={form.startTime} onChange={e=>setStart('startTime',e.target.value)}>{timeOptionsFor(form.startTime).map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></Field></div>
   <div className="cols"><Field t="End date"><input className="f" type="date" min={form.startDate||undefined} value={form.endDate} onChange={e=>setEnd('endDate',e.target.value)} required/></Field>
    <Field t="End time (New Zealand time)"><select className="f" value={form.endTime} onChange={e=>setEnd('endTime',e.target.value)}><option value="" disabled>Choose…</option>{timeOptionsFor(form.endTime).map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select></Field></div>
   <Field t="Meeting point"><input className="f" maxLength={120} value={form.meetingPoint} onChange={e=>set('meetingPoint')(e.target.value)} placeholder="e.g. Boat ramp car park"/></Field>
   <div className="cols"><Field t="Region"><select className="f" value={form.region} onChange={e=>setF({...form,region:e.target.value,district:''})} required><option value="">Choose…</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></Field>
    {districts.length>0&&<Field t="District or area (optional)"><select className="f" value={form.district} onChange={e=>set('district')(e.target.value)}><option value="">Any</option>{districts.map(d=><option key={d}>{d}</option>)}</select></Field>}</div>
   <Field t="Waterbody or place"><input className="f" list="nz-waters" maxLength={80} value={form.waterbody} onChange={e=>set('waterbody')(e.target.value)} placeholder="Start typing, e.g. Lake Taupō" required/></Field>
   <MapField label="Map location (Google Maps, optional)" value={form.map} onChange={set('map')}/>
   <datalist id="nz-waters">{NZ_WATERS.map(w=><option key={w} value={w}/>)}</datalist></div>
  <div className="c" style={{display:'grid',gap:12}}><b>Fishing</b>
   <fieldset className="fs"><legend className="m">Fishing type</legend>{WATER_TYPES.map(w=><label key={w.v} className="chk"><input type="radio" name="waterType" checked={form.waterType===w.v} onChange={()=>set('waterType')(w.v)}/> {w.l}</label>)}</fieldset>
   <div className="cols"><Field t="Discipline"><select className="f" value={form.discipline} onChange={e=>set('discipline')(e.target.value)} required><option value="">Choose…</option>{DISC.map(d=><option key={d}>{d}</option>)}</select></Field>
    {form.discipline==='Other'&&<Field t="Describe the discipline"><input className="f" maxLength={30} value={form.disciplineOther} onChange={e=>set('disciplineOther')(e.target.value)}/></Field>}</div>
   <fieldset className="fs"><legend className="m">Format</legend>{['Individual','Team'].map(x=><label key={x} className="chk"><input type="radio" name="format" checked={form.format===x} onChange={()=>set('format')(x)}/> {x}</label>)}</fieldset></div>
  <div className="c" style={{display:'grid',gap:12}}><b>Entry</b>
   <div className="cols"><Field t="Entry fee (NZD, 0 = free)"><input className="f" inputMode="decimal" value={form.fee} onChange={e=>set('fee')(e.target.value.replace(/[^\d.]/g,''))}/></Field>
    <Field t="Participant limit"><input className="f" inputMode="numeric" value={form.limit} onChange={e=>set('limit')(e.target.value.replace(/\D/g,''))}/></Field></div>
   <div className="cols"><Field t="Hosting club (optional)"><select className="f" value={form.clubId} onChange={e=>set('clubId')(e.target.value)}><option value="">None</option>{myClubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    <Field t="Status"><select className="f" value={form.status} onChange={e=>set('status')(e.target.value)}>{statusOpts.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field></div></div>
  {err&&<p role="alert" style={{color:'#A33A2B'}}>{err}</p>}
  <div className="row"><button className="p" disabled={busy}>{busy?'Saving…':form.status==='pending'?'Submit for approval':'Save event'}</button><Link className="o btn" to={id?'/event/'+id:'/'}>Cancel</Link></div></form>}
