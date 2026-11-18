import {lazy,Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import DOMPurify from 'dompurify';
import {doc,onSnapshot,serverTimestamp,setDoc} from 'firebase/firestore';
import {db} from './firebase';
import {useApp} from './store';
// The News page: one rich text document, written by admins (Admin > Placeholders > News page), shown to everybody under News.
// It is kept in settings/news as HTML. Whatever is stored is cleaned again before it is shown, so only the formatting the editor offers
// (headings, bold, italic, underline, lists, quotes, links to web and email addresses) can ever reach a visitor's screen.
export const MAX_HTML=60000;
const Editor=lazy(()=>import('./newsEditor'));
let hooked=false;
export function cleanHtml(html){
 if(!hooked){hooked=true;DOMPurify.addHook('afterSanitizeAttributes',n=>{if(n.tagName==='A'){if(n.getAttribute('href')){n.setAttribute('target','_blank');n.setAttribute('rel','noopener noreferrer')}else{n.removeAttribute('target');n.removeAttribute('rel')}}})}
 return DOMPurify.sanitize(String(html||''),{ALLOWED_TAGS:['p','br','h2','h3','strong','em','u','ul','ol','li','blockquote','a'],ALLOWED_ATTR:['href','target','rel'],ALLOWED_URI_REGEXP:/^(?:https?:|mailto:)/i});
}
const blank=h=>!String(h||'').replace(/<[^>]*>|&nbsp;|\s/g,'');
const day=d=>d?d.toLocaleDateString('en-NZ',{day:'numeric',month:'long',year:'numeric'}):'';
export function useNews(){
 const [s,setS]=useState({html:'',updatedAt:null,loading:true});
 useEffect(()=>{try{return onSnapshot(doc(db,'settings','news'),x=>{const d=x.data?.()||{};setS({html:typeof d.html==='string'?d.html:'',updatedAt:d.updatedAt?.toDate?.()||null,loading:false})},()=>setS(v=>({...v,loading:false})))}catch{setS(v=>({...v,loading:false}))}},[]);
 return s;
}
export function NewsPage(){
 const {html,updatedAt,loading}=useNews(),{user}=useApp(),clean=useMemo(()=>cleanHtml(html),[html]);
 return <><div className="row" style={{justifyContent:'space-between',marginBottom:16}}><h1>News</h1>
  {['admin','superadmin'].includes(user?.role)&&<Link className="o btn" to="/admin" state={{tab:'Placeholders'}}>Edit news</Link>}</div>
  <article className="c" aria-busy={loading||undefined}>
   {loading?<p className="m">Loading…</p>:blank(clean)?<p className="m">No news yet.</p>
    :<><div className="rte" dangerouslySetInnerHTML={{__html:clean}}/>{updatedAt&&<p className="m" style={{marginTop:16}}>Last updated {day(updatedAt)}</p>}</>}
  </article></>;
}
// Admin > Placeholders > News page
export function NewsAdmin(){
 const {user}=useApp(),{html,updatedAt,loading}=useNews(),[draft,setDraft]=useState(null),[base,setBase]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[round,setRound]=useState(0);
 const baseline=useRef(''),mine=useRef(false),loaded=useRef(null);
 const stamp=updatedAt?updatedAt.getTime():0;
 useEffect(()=>{   // the version the editor was opened on, and the arrival of our own save
  if(loading)return;
  if(loaded.current===null||mine.current){loaded.current=stamp;mine.current=false}
  setBase(loaded.current);
 },[loading,stamp]);
 if(!['admin','superadmin'].includes(user?.role))return <p>Admins only.</p>;
 const dirty=draft!==null&&draft!==baseline.current,newer=!loading&&base!==null&&stamp!==base;
 const save=async()=>{
  const clean=cleanHtml(draft).replace(/(?:<p><\/p>)+$/,'');   // the editor keeps an empty line after a heading or list so there is somewhere to type; it is not saved
  if(clean.length>MAX_HTML){setMsg('This text is too long. Shorten it a little and try again.');return}
  setBusy(true);setMsg('');
  try{await setDoc(doc(db,'settings','news'),{html:blank(clean)?'':clean,updatedAt:serverTimestamp(),updatedBy:user.id});mine.current=true;baseline.current=draft;setDraft(draft);setMsg('Saved. The News page is updated.')}
  catch(e){setMsg(e.message||'Could not save.')}
  setBusy(false);
 };
 const discard=()=>{setDraft(null);setMsg('');setRound(r=>r+1)};
 return <div className="c" style={{display:'grid',gap:10}}>
  <p className="m">This is the text of the <b>News</b> page in the top menu. Use the buttons for headings, bold, lists and links. Nothing changes on the News page until you press the Save button.</p>
  {loading?<p className="m">Loading…</p>:<Suspense fallback={<p className="m">Loading the editor…</p>}>
   <Editor key={round} value={html} onReady={e=>{baseline.current=e.getHTML()}} onChange={setDraft}/></Suspense>}
  {newer&&<p role="alert" className="m">Another admin saved a newer version of the news while you were editing. Saving now replaces it.</p>}
  <div className="row"><button type="button" className="p" disabled={!dirty||busy} onClick={save}>{busy?'Saving…':'Save'}</button>
   <button type="button" className="o" disabled={!dirty||busy} onClick={discard}>Discard changes</button>
   {dirty&&<span className="m" role="status">You have unsaved changes.</span>}{updatedAt&&<span className="m">Saved {day(updatedAt)}</span>}</div>
  {msg&&<p role="status" className="m">{msg}</p>}</div>;
}
