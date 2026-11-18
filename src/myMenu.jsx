import {useEffect,useRef,useState} from 'react';
import {NavLink,useLocation} from 'react-router-dom';
import {PendingBadge} from './approvals';
// "My page" in the top menu for organisers and admins: one entry that opens a short list (Profile, Manage, and Admin for admins).
// A participant has no list, just the plain "My page" link. The small red number on the entry is the sum of the numbers inside.
// The list is placed with position:fixed (measured when it opens) because on a phone the menu bar scrolls sideways and would cut it off.
// Opens with a click, Enter, Space or the Down arrow; closes with Escape (focus returns to the button), a click elsewhere, a page change,
// scrolling or leaving it with Tab.
export default function MyMenu({items,n=0,sr}){
 const [open,setOpen]=useState(false),[pos,setPos]=useState({}),box=useRef(null),btn=useRef(null),first=useRef(false),{pathname}=useLocation();
 const on=items.some(i=>pathname===i.to||pathname.startsWith(i.to+'/'));
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{
  if(!open)return;
  const away=e=>{if(!box.current?.contains(e.target))setOpen(false)},close=()=>setOpen(false);
  document.addEventListener('pointerdown',away);window.addEventListener('resize',close);document.addEventListener('scroll',close,true);
  if(first.current){first.current=false;box.current?.querySelector('a')?.focus()}
  return()=>{document.removeEventListener('pointerdown',away);window.removeEventListener('resize',close);document.removeEventListener('scroll',close,true)};
 },[open]);
 const show=()=>{
  const r=btn.current.getBoundingClientRect(),w=Math.min(240,window.innerWidth-16);
  setPos({top:Math.round(r.bottom)+4,left:Math.round(Math.max(8,Math.min(r.left,window.innerWidth-w-8))),minWidth:Math.min(190,w)});setOpen(true);
 };
 const key=e=>{
  const links=[...box.current.querySelectorAll('a')],at=links.indexOf(document.activeElement);
  if(e.key==='Escape'&&open){e.preventDefault();setOpen(false);btn.current.focus()}
  else if(e.key==='ArrowDown'){e.preventDefault();if(!open){first.current=true;show()}else links[(at+1)%links.length]?.focus()}
  else if(e.key==='ArrowUp'&&open){e.preventDefault();links[(at<=0?links.length:at)-1]?.focus()}
  else if(e.key==='Home'&&open&&at>=0){e.preventDefault();links[0]?.focus()}
  else if(e.key==='End'&&open&&at>=0){e.preventDefault();links.at(-1)?.focus()}
 };
 return <div className="mm" ref={box} onKeyDown={key} onBlur={e=>{if(open&&!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}>
  <button ref={btn} type="button" className={'mmb'+(on?' active':'')} aria-expanded={open} aria-controls="my-menu" onClick={()=>open?setOpen(false):show()}>
   <span className="nl">My page<span className="mmc" aria-hidden="true">▾</span><PendingBadge n={n} sr={sr}/></span></button>
  {open&&<ul id="my-menu" className="mmp" style={pos}>{items.map(i=><li key={i.to}><NavLink to={i.to} end><span className="nl">{i.label}<PendingBadge n={i.n} sr={i.sr}/></span></NavLink></li>)}</ul>}
 </div>;
}
