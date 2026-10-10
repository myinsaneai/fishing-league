import {useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {useApp} from './store';
import {useClubs} from './clubsStore';
import ImageDrop from './ImageDrop';
import Cover from './Cover';
import {DISC,REGIONS} from './data';
const ADMINS=['admin','superadmin'],STAFF=['organiser','admin','superadmin'];
export const WATER_TYPES=[{v:'Sea',l:'Sea fishing'},{v:'Freshwater',l:'Freshwater fishing'}];
export const safeUrl=u=>{try{const x=new URL(u);return (x.protocol==='https:'||x.protocol==='http:')&&x.hostname.includes('.')?u:''}catch{return ''}};
export const normUrl=u=>{const t=(u||'').trim();return !t?'':/^https?:\/\//i.test(t)?t:'https://'+t};
export function validate(f){
 if(f.name.trim().length<2)return 'Give the club a name (at least 2 characters).';
 if(!f.waterTypes.length)return 'Choose Sea fishing, Freshwater fishing or both.';
 if(!f.region)return 'Choose a region.';
 if(f.email&&!/^\S+@\S+\.\S+$/.test(f.email.trim()))return 'That contact email does not look right.';
 if(f.website&&!safeUrl(normUrl(f.website)))return 'That website address does not look right.';
 if(f.social&&!safeUrl(normUrl(f.social)))return 'That social link does not look right.';
 if(f.founded){const y=Number(f.founded);if(!Number.isInteger(y)||y<1850||y>new Date().getFullYear())return 'Founded year should be between 1850 and this year.'}
 return '';
}
export const toData=f=>({name:f.name.trim(),tagline:f.tagline.trim(),description:f.description.trim(),waterTypes:f.waterTypes,disciplines:f.disciplines,region:f.region,town:f.town.trim(),email:f.email.trim(),website:normUrl(f.website),social:normUrl(f.social),founded:f.founded?Number(f.founded):null,meetings:f.meetings.trim()});
const blank={name:'',tagline:'',description:'',waterTypes:[],disciplines:[],region:'',town:'',email:'',website:'',social:'',founded:'',meetings:''};
const fromClub=c=>Object.fromEntries(Object.keys(blank).map(k=>[k,c[k]??blank[k]]));
const canEditClub=(u,c)=>!!u&&(c.ownerId===u.id||ADMINS.includes(u.role));
// Defined at module level on purpose: a component created inside another component is rebuilt on every render, which makes inputs lose focus.
const Field=({t,children})=><label className="m" style={{display:'grid',gap:4}}>{t}{children}</label>;
const Tags=({c})=><div className="row" style={{gap:6}}>{(c.waterTypes||[]).map(w=><span key={w} className="t n">{w}</span>)}{(c.disciplines||[]).slice(0,3).map(d=><span key={d} className="t">{d}</span>)}{(c.disciplines||[]).length>3&&<span className="t">+{c.disciplines.length-3}</span>}</div>;
export function Clubs(){
 const {user,toggleClub}=useApp(),{clubs,loading,error}=useClubs(),can=user&&STAFF.includes(user.role);
 return <><div className="row" style={{justifyContent:'space-between',marginBottom:16}}><h1>Clubs</h1>{can&&<Link className="p btn" to="/clubs/new">Create club</Link>}</div>
  {error&&<p role="alert" className="m" style={{color:'#A33A2B'}}>{error}</p>}
  {loading?<p className="m">Loading clubs…</p>:!clubs.length?<div className="c"><p className="m">No clubs yet.{can?' Create the first one.':''}</p></div>:
  <div className="grid">{clubs.map(c=><div className="c card" key={c.id}><Link to={'/clubs/'+c.id}><Cover c={c}/></Link>
   <div style={{padding:16,display:'grid',gap:8}}><Link to={'/clubs/'+c.id}><b>{c.name}</b></Link><span className="m">{[c.town,c.region].filter(Boolean).join(', ')}</span><Tags c={c}/>{c.tagline&&<span className="m">{c.tagline}</span>}
    {user&&<button className={user.clubs.includes(c.id)?'o':'p'} onClick={()=>toggleClub(c.id)}>{user.clubs.includes(c.id)?'Leave':'Join'}</button>}</div></div>)}</div>}</>}
export function ClubPage(){
 const {id}=useParams(),{user,toggleClub}=useApp(),{clubs,loading}=useClubs(),c=clubs.find(x=>x.id===id);
 if(loading)return <p className="m">Loading…</p>;
 if(!c)return <div className="c" style={{display:'grid',gap:8}}><p>Club not found.</p><Link to="/clubs">Back to clubs</Link></div>;
 const web=safeUrl(c.website),soc=safeUrl(c.social),joined=user?.clubs.includes(c.id),rows=[['Where',[c.town,c.region].filter(Boolean).join(', ')],['Founded',c.founded||''],['Meets',c.meetings||'']].filter(r=>r[1]);
 return <><p className="m"><Link to="/clubs">Clubs</Link> / {c.name}</p>
  <div style={{maxWidth:900,display:'grid',gap:16,marginTop:8}}><Cover c={c} alt={c.name+' cover image'}/>
   <div><h1>{c.name}</h1>{c.tagline&&<p className="m" style={{marginTop:4}}>{c.tagline}</p>}</div><Tags c={c}/>
   <div className="row">{user&&<button className={joined?'o':'p'} onClick={()=>toggleClub(c.id)}>{joined?'Leave club':'Join club'}</button>}{canEditClub(user,c)&&<Link className="o btn" to={'/clubs/'+c.id+'/edit'}>Edit club</Link>}</div>
   {c.description&&<div className="c"><h2 style={{fontSize:20,marginBottom:8}}>About</h2><p style={{whiteSpace:'pre-wrap',lineHeight:1.6}}>{c.description}</p></div>}
   <div className="c"><h2 style={{fontSize:20,marginBottom:8}}>Details</h2>
    {rows.map(([k,v])=><div className="li" key={k}><span className="m" style={{flex:'0 0 90px'}}>{k}</span><span className="g">{v}</span></div>)}
    {c.email&&<div className="li"><span className="m" style={{flex:'0 0 90px'}}>Email</span><a className="g" href={'mailto:'+c.email}>{c.email}</a></div>}
    {web&&<div className="li"><span className="m" style={{flex:'0 0 90px'}}>Website</span><a className="g" href={web} target="_blank" rel="noopener noreferrer">{web.replace(/^https?:\/\//,'')}</a></div>}
    {soc&&<div className="li"><span className="m" style={{flex:'0 0 90px'}}>Social</span><a className="g" href={soc} target="_blank" rel="noopener noreferrer">{soc.replace(/^https?:\/\//,'')}</a></div>}
    {!rows.length&&!c.email&&!web&&!soc&&<p className="m">No details added yet.</p>}</div></div></>}
export function ClubEditor(){
 const {id}=useParams(),nav=useNavigate(),{user}=useApp(),{clubs,loading,saveClub}=useClubs(),club=id?clubs.find(x=>x.id===id):null;
 const [f,setF]=useState(null),[img,setImg]=useState({}),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
 if(id&&loading)return <p className="m">Loading…</p>;
 if(id&&!club)return <div className="c"><p>Club not found.</p><Link to="/clubs">Back to clubs</Link></div>;
 if(id&&!canEditClub(user,club))return <div className="c"><p>Only the club's owner or an admin can edit this club.</p><Link to={'/clubs/'+id}>Back to the club</Link></div>;
 const form=f||(club?fromClub(club):blank),set=k=>v=>setF({...form,[k]:v}),tog=(k,v)=>set(k)(form[k].includes(v)?form[k].filter(x=>x!==v):[...form[k],v]);
 const submit=async e=>{
  e.preventDefault();const m=validate(form);if(m){setErr(m);return}
  setBusy(true);setErr('');
  try{
   const r=await saveClub({id,data:toData(form),file:img.file,removeImage:img.remove,user});
   if(r.imageError){setErr('The club was saved, but the image upload failed: '+r.imageError);setBusy(false);if(!id)nav('/clubs/'+r.id+'/edit',{replace:true});return}
   nav('/clubs/'+r.id);
  }catch(x){setErr(x.message);setBusy(false)}
 };
 return <form className="form" onSubmit={submit} noValidate><h1>{id?'Edit club':'Create club'}</h1>
  <div className="c" style={{display:'grid',gap:12}}><b>Cover image</b><ImageDrop url={club?.coverUrl} onChange={setImg}/></div>
  <div className="c" style={{display:'grid',gap:12}}><b>Basics</b>
   <Field t="Club name"><input className="f" maxLength={80} value={form.name} onChange={e=>set('name')(e.target.value)} required/></Field>
   <Field t={`Tagline (${form.tagline.length}/120)`}><input className="f" maxLength={120} value={form.tagline} onChange={e=>set('tagline')(e.target.value)} placeholder="One line about the club"/></Field>
   <Field t={`About the club (${form.description.length}/1500)`}><textarea className="f" rows={5} maxLength={1500} value={form.description} onChange={e=>set('description')(e.target.value)}/></Field></div>
  <div className="c" style={{display:'grid',gap:12}}><b>Fishing</b>
   <fieldset className="fs"><legend className="m">Fishing type (choose at least one)</legend>{WATER_TYPES.map(w=><label key={w.v} className="chk"><input type="checkbox" checked={form.waterTypes.includes(w.v)} onChange={()=>tog('waterTypes',w.v)}/> {w.l}</label>)}</fieldset>
   <div><div className="m" style={{marginBottom:6}}>Disciplines</div><div className="row">{DISC.map(d=><button type="button" key={d} aria-pressed={form.disciplines.includes(d)} className={'k'+(form.disciplines.includes(d)?' on':'')} onClick={()=>tog('disciplines',d)}>{d}</button>)}</div></div>
   <div className="cols"><Field t="Region"><select className="f" value={form.region} onChange={e=>set('region')(e.target.value)} required><option value="">Choose…</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></Field>
    <Field t="Town or area"><input className="f" maxLength={60} value={form.town} onChange={e=>set('town')(e.target.value)}/></Field></div></div>
  <div className="c" style={{display:'grid',gap:12}}><b>Contact and details</b>
   <div className="cols"><Field t="Contact email (shown publicly)"><input className="f" type="email" autoComplete="off" value={form.email} onChange={e=>set('email')(e.target.value)}/></Field>
    <Field t="Founded (year)"><input className="f" inputMode="numeric" maxLength={4} value={form.founded} onChange={e=>set('founded')(e.target.value.replace(/\D/g,''))}/></Field>
    <Field t="Website"><input className="f" inputMode="url" placeholder="example.co.nz" value={form.website} onChange={e=>set('website')(e.target.value)}/></Field>
    <Field t="Facebook or Instagram page"><input className="f" inputMode="url" value={form.social} onChange={e=>set('social')(e.target.value)}/></Field></div>
   <Field t="When and where the club meets"><input className="f" maxLength={200} value={form.meetings} onChange={e=>set('meetings')(e.target.value)} placeholder="e.g. first Tuesday of the month, 7 pm"/></Field></div>
  {err&&<p role="alert" style={{color:'#A33A2B'}}>{err}</p>}
  <div className="row"><button className="p" disabled={busy}>{busy?'Saving…':'Save club'}</button><Link className="o btn" to={id?'/clubs/'+id:'/clubs'}>Cancel</Link></div></form>}
