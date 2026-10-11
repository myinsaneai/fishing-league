import {useState} from 'react';
import {useApp} from './store';
import {usePlaceholderApi} from './placeholders';
import ImageDrop from './ImageDrop';
const SLOTS=[
 {kind:'club',title:'Club photo',hint:'Shown for clubs that have no photo, or whose photo cannot be loaded.',ratio:16/9,maxW:1280,ratioLabel:'16:9',width:420},
 {kind:'event',title:'Event photo',hint:'Shown for events that have no photo, or whose photo cannot be loaded.',ratio:16/9,maxW:1280,ratioLabel:'16:9',width:420},
 {kind:'avatar',title:'Profile picture',hint:'Shown for people without a profile picture, or whose picture cannot be loaded.',ratio:1,maxW:512,ratioLabel:'square',width:200}];
function Slot({s}){
 const {user}=useApp(),{placeholders,savePlaceholder}=usePlaceholderApi(),[img,setImg]=useState({}),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const dirty=!!(img.file||img.remove);
 const save=async()=>{setBusy(true);setMsg('');try{await savePlaceholder(s.kind,img,user);setImg({});setMsg('Saved.')}catch(e){setMsg(e.message)}setBusy(false)};
 return <div className="c" style={{display:'grid',gap:10}}><b>{s.title}</b><p className="m">{s.hint}</p>
  <div style={{maxWidth:s.width}}><ImageDrop url={placeholders[s.kind]} ratio={s.ratio} maxW={s.maxW} ratioLabel={s.ratioLabel} optional={false} onChange={x=>{setImg(x);setMsg('')}}/></div>
  <div className="row"><button className="p" disabled={!dirty||busy} onClick={save}>{busy?'Saving…':'Save'}</button>{msg&&<span role="status" className="m">{msg}</span>}</div></div>}
export function PlaceholderSettings(){
 const {user}=useApp();
 if(user?.role!=='superadmin')return <p>Only a superadmin can change the placeholder pictures.</p>;
 return <div style={{display:'grid',gap:16}}><p className="m">These pictures stand in wherever a club photo, event photo or profile picture is missing or cannot be loaded. Without one, a plain tile with the first letter is used.</p>{SLOTS.map(s=><Slot key={s.kind} s={s}/>)}</div>}
