// Event times are always entered and shown on a New Zealand clock, whatever time zone the browser is in.
const TZ='Pacific/Auckland';
const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
// The date ("YYYY-MM-DD") and time ("HH:mm") a New Zealand clock shows at this instant.
export function nzParts(d){
 const p=Object.fromEntries(fmt.formatToParts(d).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
const offsetMs=t=>{const p=nzParts(new Date(t)),[y,m,d]=p.date.split('-').map(Number),[h,mi]=p.time.split(':').map(Number);return Date.UTC(y,m-1,d,h,mi)-t};
// The instant at which a New Zealand clock reads the given date and time (handles daylight saving).
export function nzToDate(dateStr,timeStr){
 const [y,m,d]=dateStr.split('-').map(Number),[h,mi]=timeStr.split(':').map(Number),guess=Date.UTC(y,m-1,d,h,mi);
 let t=guess-offsetMs(guess);t=guess-offsetMs(t);
 return new Date(t);
}
export const timeLabel=v=>{const [h,m]=v.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'am':'pm'}`};
// Every 15 minutes, 12:00 am to 11:45 pm.
export const TIME_OPTIONS=Array.from({length:96},(_,i)=>{const v=`${String(Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`;return {v,l:timeLabel(v)}});
// The list, plus the current value when it is not on the 15-minute grid (for example an older 6:10 am start).
export const timeOptionsFor=v=>!v||TIME_OPTIONS.some(o=>o.v===v)?TIME_OPTIONS:[...TIME_OPTIONS,{v,l:timeLabel(v)}].sort((a,b)=>a.v.localeCompare(b.v));
// A sensible end for a new event: four hours after the start, on the New Zealand clock.
export const suggestEnd=(dateStr,timeStr)=>nzParts(new Date(nzToDate(dateStr,timeStr).getTime()+4*3600e3));
