// Google Maps locations for clubs and events: a pasted Google Maps link or plain coordinates.
const MSG='Paste a Google Maps link (Share → Copy link), or coordinates like -41.2865, 174.7762.';
const HOST=/^(www\.|maps\.)?google\.(com|co\.nz)$/i;
const none={mapUrl:'',lat:null,lng:null,error:''};
export function parseMapInput(text){
 const t=(text||'').trim();
 if(!t)return none;
 const c=t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
 if(c){
  const lat=Number(c[1]),lng=Number(c[2]);
  if(lat<-90||lat>90||lng<-180||lng>180)return {...none,error:'Those coordinates are out of range. Latitude is -90 to 90 and longitude -180 to 180.'};
  return {mapUrl:`https://www.google.com/maps?q=${lat},${lng}`,lat,lng,error:''};
 }
 let u;try{u=new URL(t)}catch{return {...none,error:MSG}}
 const h=u.hostname.toLowerCase();
 const ok=u.protocol==='https:'&&((HOST.test(h)&&u.pathname.startsWith('/maps'))||h==='maps.app.goo.gl'||(h==='goo.gl'&&u.pathname.startsWith('/maps')));
 if(!ok)return {...none,error:MSG};
 if(u.href.length>1000)return {...none,error:'That link is too long. Use Share → Copy link in Google Maps to get a shorter one.'};
 let m=u.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
 if(!m){const q=u.searchParams.get('q')||u.searchParams.get('query')||u.searchParams.get('ll')||'';m=q.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/)}
 return {mapUrl:u.href,lat:m?Number(m[1]):null,lng:m?Number(m[2]):null,error:''};
}
// A link that drops a pin on a position (used for the location found inside an evidence photo).
export const pinUrl=(lat,lng)=>`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const mapFields=text=>{const r=parseMapInput(text);return {mapUrl:r.mapUrl,lat:r.lat,lng:r.lng}};
const KEY=import.meta.env.VITE_MAPS_EMBED_KEY;
// With a Maps Embed API key the official embed is used; without one, the keyless embed.
export const embedSrc=(lat,lng)=>KEY?`https://www.google.com/maps/embed/v1/place?key=${KEY}&q=${lat},${lng}&zoom=14`:`https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
// Defined at module level on purpose (a component created inside another one makes inputs lose focus).
export function MapField({label,value,onChange}){
 const r=parseMapInput(value);
 return <label className="m" style={{display:'grid',gap:4}}>{label}
  <input className="f" inputMode="url" maxLength={1000} value={value} onChange={e=>onChange(e.target.value)} placeholder="Paste a Google Maps link, or coordinates like -41.2865, 174.7762"/>
  <span style={{fontSize:13}}>{r.error?<span role="alert" style={{color:'#A33A2B'}}>{r.error}</span>:r.lat!=null?'Location found. A map will be shown on the page.':r.mapUrl?'Link saved. People can open it in Google Maps (short links have no map preview).':'In Google Maps, use Share → Copy link, or right-click a spot and click the coordinates.'}</span></label>}
export function MapView({item,style}){
 const url=parseMapInput(item.mapUrl).mapUrl,has=item.lat!=null&&item.lng!=null&&!parseMapInput(item.mapUrl).error;
 if(!url&&!has)return null;
 return <div className="c" style={{display:'grid',gap:10,...style}}><b>Location</b>
  {has&&<iframe title={'Map of '+(item.name||'the location')} src={embedSrc(item.lat,item.lng)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen style={{border:0,width:'100%',aspectRatio:'16/9',borderRadius:8}}/>}
  <div className="row">{url&&<a className="o btn" href={url} target="_blank" rel="noopener noreferrer">Open in Google Maps</a>}{has&&<a className="o btn" href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`} target="_blank" rel="noopener noreferrer">Directions</a>}</div></div>}
