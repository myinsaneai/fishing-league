import {useState} from 'react';
import {useApp} from './store';
import {useAuth} from './auth';
import Avatar from './Avatar';
import ImageDrop from './ImageDrop';
// My page: the person's picture with a way to change or remove it (real accounts only).
export default function AvatarEditor(){
 const {user,real}=useApp(),{setAvatar,clearAvatar}=useAuth();
 const [open,setOpen]=useState(false),[img,setImg]=useState({}),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const dirty=!!(img.file||img.remove);
 const save=async()=>{setBusy(true);setMsg('');try{if(img.file)await setAvatar(img.file);else await clearAvatar();setOpen(false);setImg({});setMsg('Picture updated.')}catch(e){setMsg(e.message)}setBusy(false)};
 return <div style={{display:'grid',gap:10}}>
  <div className="row"><Avatar url={user.photo} name={user.name} size={72}/>{real&&!open&&<button className="o" onClick={()=>{setOpen(true);setMsg('')}}>Change picture</button>}</div>
  {open&&<div style={{display:'grid',gap:10}}><div style={{maxWidth:200}}><ImageDrop url={user.photo} ratio={1} maxW={512} ratioLabel="square" optional={false} onChange={setImg}/></div>
   <div className="row"><button className="p" disabled={!dirty||busy} onClick={save}>{busy?'Saving…':'Save picture'}</button><button className="o" disabled={busy} onClick={()=>{setOpen(false);setImg({})}}>Cancel</button></div></div>}
  {msg&&<span role="status" className="m">{msg}</span>}</div>}
