import {useState} from 'react';
import {usePlaceholders} from './placeholders';
// 16:9 photo for a club or event. If there is no photo, or it fails to load, the superadmin's placeholder
// for that kind is shown; if there is none (or it fails too), a plain tile with the first letter.
export default function Cover({c,alt='',kind}){
 const ph=usePlaceholders()[kind]||'',[bad,setBad]=useState(''),[badPh,setBadPh]=useState(false);
 if(c.coverUrl&&bad!==c.coverUrl)return <img className="cover" src={c.coverUrl} alt={alt} loading="lazy" onError={()=>setBad(c.coverUrl)}/>;
 if(ph&&!badPh)return <img className="cover" src={ph} alt={alt} loading="lazy" onError={()=>setBadPh(true)}/>;
 return <div className="cover ph" aria-hidden="true">{(c.name||'?').slice(0,1).toUpperCase()}</div>}
