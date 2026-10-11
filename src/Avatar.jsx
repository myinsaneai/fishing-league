import {useState} from 'react';
import {usePlaceholders} from './placeholders';
// Round profile picture: the person's own photo, else the superadmin's placeholder, else their initial.
export default function Avatar({url,name='',size=36}){
 const {avatar}=usePlaceholders(),[bad,setBad]=useState(''),[badPh,setBadPh]=useState(false);
 const box={width:size,height:size,borderRadius:'50%',flex:'none',objectFit:'cover',display:'block'};
 if(url&&bad!==url)return <img src={url} alt="" style={box} referrerPolicy="no-referrer" onError={()=>setBad(url)}/>;
 if(avatar&&!badPh)return <img src={avatar} alt="" style={box} onError={()=>setBadPh(true)}/>;
 return <div className="i" aria-hidden="true" style={{...box,display:'grid',placeItems:'center',fontWeight:600,fontSize:Math.round(size*.4),color:'#2F6B52'}}>{(name||'?').trim().slice(0,1).toUpperCase()}</div>}
