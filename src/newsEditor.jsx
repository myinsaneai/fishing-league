import {useState} from 'react';
import {EditorContent,useEditor,useEditorState} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
// The rich text editor for the News page (loaded only when an admin opens it). The schema is kept small on purpose: headings (two levels),
// bold, italic, underline, bulleted and numbered lists, quotes and links. Whatever else is pasted in is dropped by the editor itself, and the
// News page cleans the saved text once more before showing it.
export const fixLink=raw=>{
 const v=String(raw||'').trim();
 if(!v)return '';
 if(/^(https?:\/\/|mailto:)\S+$/i.test(v))return v;
 if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return 'mailto:'+v;
 if(/^[^\s:/]+\.[^\s:/]{2,}(\/\S*)?$/.test(v))return 'https://'+v;
 return '';
};
const B=({label,on,off,children,...p})=><button type="button" className={'rtb'+(on?' on':'')} aria-label={label} aria-pressed={on===undefined?undefined:!!on} disabled={off} onMouseDown={e=>e.preventDefault()} {...p}>{children}</button>;
export default function NewsEditor({value,onChange,onReady}){
 const [linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState(''),[err,setErr]=useState('');
 const editor=useEditor({
  extensions:[StarterKit.configure({heading:{levels:[2,3]},code:false,codeBlock:false,strike:false,horizontalRule:false,
   link:{openOnClick:false,autolink:true,protocols:['http','https','mailto'],HTMLAttributes:{rel:'noopener noreferrer',target:'_blank'}}})],
  content:value||'',
  editorProps:{attributes:{role:'textbox','aria-multiline':'true','aria-label':'News text',class:'rte rte-edit'}},
  onCreate:({editor})=>onReady?.(editor),
  onUpdate:({editor})=>onChange?.(editor.getHTML()),
 });
 const s=useEditorState({editor,selector:({editor:e})=>e?{bold:e.isActive('bold'),italic:e.isActive('italic'),underline:e.isActive('underline'),h2:e.isActive('heading',{level:2}),h3:e.isActive('heading',{level:3}),
  ul:e.isActive('bulletList'),ol:e.isActive('orderedList'),quote:e.isActive('blockquote'),link:e.isActive('link'),undo:e.can().undo(),redo:e.can().redo()}:null});
 if(!editor||!s)return <div className="rte-box" style={{minHeight:260}}/>;
 const c=()=>editor.chain().focus();
 const openLink=()=>{setErr('');setUrl(editor.getAttributes('link').href||'');setLinkOpen(o=>!o)};
 const applyLink=()=>{
  const href=fixLink(url);
  if(!href){setErr('Type a web address such as https://example.com, or an email address.');return}
  if(editor.state.selection.empty&&!editor.isActive('link')){setErr('Select the words that should be the link first.');return}
  c().extendMarkRange('link').setLink({href}).run();setLinkOpen(false);setErr('');
 };
 return <div className="rte-box">
  <div role="toolbar" aria-label="Text formatting" className="rte-bar">
   <B label="Heading" on={s.h2} onClick={()=>c().toggleHeading({level:2}).run()}>H<sub>2</sub></B>
   <B label="Subheading" on={s.h3} onClick={()=>c().toggleHeading({level:3}).run()}>H<sub>3</sub></B>
   <B label="Bold" on={s.bold} onClick={()=>c().toggleBold().run()}><b>B</b></B>
   <B label="Italic" on={s.italic} onClick={()=>c().toggleItalic().run()}><i>I</i></B>
   <B label="Underline" on={s.underline} onClick={()=>c().toggleUnderline().run()}><u>U</u></B>
   <B label="Bulleted list" on={s.ul} onClick={()=>c().toggleBulletList().run()}>• List</B>
   <B label="Numbered list" on={s.ol} onClick={()=>c().toggleOrderedList().run()}>1. List</B>
   <B label="Quote" on={s.quote} onClick={()=>c().toggleBlockquote().run()}>“ ”</B>
   <B label="Link" on={s.link} aria-expanded={linkOpen} onClick={openLink}>Link</B>
   <B label="Undo" off={!s.undo} onClick={()=>c().undo().run()}>↶</B>
   <B label="Redo" off={!s.redo} onClick={()=>c().redo().run()}>↷</B>
  </div>
  {linkOpen&&<div className="rte-link"><label className="m" style={{display:'grid',gap:4,flex:1}}>Web address<input className="f" value={url} onChange={e=>{setUrl(e.target.value);setErr('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();applyLink()}}} placeholder="https://"/></label>
   <button type="button" className="o" onClick={applyLink}>Apply</button>
   {s.link&&<button type="button" className="o" onClick={()=>{c().extendMarkRange('link').unsetLink().run();setLinkOpen(false)}}>Remove link</button>}
   {err&&<p role="alert" className="m" style={{flexBasis:'100%'}}>{err}</p>}</div>}
  <EditorContent editor={editor}/>
 </div>;
}
