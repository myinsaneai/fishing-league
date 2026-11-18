// @vitest-environment jsdom
import {describe,it,expect,vi,afterEach,beforeEach} from 'vitest';
import {render,screen,act,fireEvent,cleanup,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
const writes=[];
vi.mock('firebase/auth',()=>({onAuthStateChanged:(a,cb)=>{globalThis.__cb=cb;return()=>{}},signInWithPopup:vi.fn(),GoogleAuthProvider:class{},signInWithEmailAndPassword:vi.fn(),createUserWithEmailAndPassword:vi.fn(),updateProfile:vi.fn(),sendEmailVerification:vi.fn(),sendPasswordResetEmail:vi.fn(),signOut:vi.fn()}));
vi.mock('firebase/firestore',()=>({
 doc:(...a)=>({id:a[a.length-1],path:a.slice(1).join('/')}),collection:(db,...p)=>({name:p[0],path:p.join('/')}),where:(f,op,v)=>({f,op,v}),orderBy:x=>x,query:(c,...cs)=>({name:c.name,path:c.path,cs}),
 setDoc:async(r,d,o)=>{if(globalThis.__setDocFails)throw new Error('write refused');writes.push(['set',r.path,d,o])},updateDoc:async()=>{},deleteDoc:async()=>{},
 getDoc:async()=>({exists:()=>true,data:()=>({clubIds:[]})}),
 onSnapshot:(q,ok,fail)=>{
  if(q.path==='settings/news'){if(globalThis.__newsFail){fail?.(new Error('no permission'));return()=>{}}const send=()=>ok({data:()=>globalThis.__news||{}});globalThis.__newsSend=send;send();return()=>{}}
  if(q.path==='settings/placeholders'){ok({data:()=>({})});return()=>{}}
  if(q.path==='settings/carousel'){ok({data:()=>({enabled:false})});return()=>{}}
  const src=q.name==='events'?(globalThis.__events||[]):[];ok({docs:src.map(e=>({id:e.id,data:()=>e})),data:()=>({})});return()=>{}},
 serverTimestamp:()=>'TS',arrayUnion:x=>x,arrayRemove:x=>x}));
vi.mock('firebase/storage',()=>({ref:(s,p)=>({path:p}),uploadBytes:async()=>{},getDownloadURL:async r=>'https://files.test/'+r.path,deleteObject:async()=>{}}));
vi.mock('../src/firebase',()=>({auth:{},db:{},storage:{},call:()=>async()=>({data:{}})}));
import {AuthProvider} from '../src/auth';
import {AppProvider} from '../src/store';
import {ClubsProvider} from '../src/clubsStore';
import {EventsProvider} from '../src/eventsStore';
import {RegistrationsProvider} from '../src/registrations';
import App from '../src/App';
import {cleanHtml,MAX_HTML} from '../src/news';
import {fixLink} from '../src/newsEditor';
const ts=(d)=>({toDate:()=>d});
const fb=(role,uid='a1')=>({uid,displayName:'Alexei K',email:uid+'@x.com',emailVerified:true,getIdTokenResult:async()=>({claims:{role}})});
const app=entry=>render(<MemoryRouter initialEntries={[entry]}><AuthProvider><ClubsProvider><EventsProvider><RegistrationsProvider><AppProvider><App/></AppProvider></RegistrationsProvider></EventsProvider></ClubsProvider></AuthProvider></MemoryRouter>);
const signIn=async u=>{await act(async()=>{await globalThis.__cb(u)})};
beforeEach(()=>{
 writes.length=0;globalThis.__news=undefined;globalThis.__newsFail=false;globalThis.__setDocFails=false;globalThis.__events=[];
 // The test browser has no layout, which the editor's cursor handling asks about.
 const r={getBoundingClientRect:()=>({top:0,left:0,right:0,bottom:0,width:0,height:0,x:0,y:0}),getClientRects:()=>[]};
 Object.assign(Range.prototype,r);Object.assign(Text.prototype,{getClientRects:()=>[]});Document.prototype.elementFromPoint=()=>null;
});
afterEach(()=>{cleanup();vi.restoreAllMocks()});
describe('cleaning the saved text before it is shown',()=>{
 it('keeps the formatting the editor offers',()=>{
  const h='<h2>Title</h2><h3>Sub</h3><p>One <strong>bold</strong> <em>it</em> <u>under</u><br>line</p><ul><li>a</li></ul><ol><li>b</li></ol><blockquote><p>q</p></blockquote>';
  expect(cleanHtml(h)).toBe(h);
 });
 it('removes anything that could run code or load something',()=>{
  const dirty='<p onclick="x()">Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://evil.test"></iframe><style>p{}</style><a href="javascript:alert(1)">bad</a><a href="data:text/html,x">bad2</a><div style="color:red">div</div><svg onload="x"></svg><form action="/x"><input></form>';
  const c=cleanHtml(dirty);
  expect(c).not.toMatch(/script|onerror|onclick|iframe|<img|<style|javascript:|data:|<svg|<form|<input|style=/i);expect(c).toContain('Hi');expect(c).toContain('div');
 });
 it('opens links in a new tab without handing over the opener, for web and email addresses only',()=>{
  const c=cleanHtml('<a href="https://example.com/x">w</a><a href="mailto:a@b.nz">m</a><a href="/relative">r</a><a href="ftp://x.test">f</a><a name="n">n</a>');
  expect(c).toContain('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">w</a>');expect(c).toContain('href="mailto:a@b.nz"');
  expect(c).not.toContain('/relative');expect(c).not.toContain('ftp:');expect(c).not.toMatch(/<a[^>]*name/);
 });
 it('copes with nothing at all',()=>{expect(cleanHtml(undefined)).toBe('');expect(cleanHtml(null)).toBe('');expect(cleanHtml(42)).toBe('42')});
});
describe('typing a web address for a link',()=>{
 it('accepts web and email addresses and adds what is missing',()=>{
  expect(fixLink(' https://example.com/a?b=1 ')).toBe('https://example.com/a?b=1');expect(fixLink('http://x.nz')).toBe('http://x.nz');
  expect(fixLink('example.com')).toBe('https://example.com');expect(fixLink('www.example.co.nz/path')).toBe('https://www.example.co.nz/path');
  expect(fixLink('me@example.com')).toBe('mailto:me@example.com');expect(fixLink('mailto:me@example.com')).toBe('mailto:me@example.com');
 });
 it('refuses everything else',()=>{['','   ','javascript:alert(1)','ftp://x.test','two words','data:text/html,x','https://','notaddress'].forEach(v=>expect(fixLink(v),v).toBe(''))});
});
describe('the News page',()=>{
 const page=async(u=null)=>{app('/news');await signIn(u)};
 it('is in the main menu between Events and Clubs, for everybody',async()=>{
  await page();const nav=screen.getByRole('navigation',{name:'Main'}),links=within(nav).getAllByRole('link').map(a=>a.textContent);
  expect(links.slice(0,3)).toEqual(['Events','News','Clubs']);expect(within(nav).getByRole('link',{name:'News'}).getAttribute('href')).toBe('/news');
 });
 it('shows the text with its formatting, and when it was last saved',async()=>{
  globalThis.__news={html:'<h2>Season opens</h2><p>Come <strong>along</strong> and <a href="https://example.com">read more</a>.</p><ul><li>Bring a rod</li></ul>',updatedAt:ts(new Date('2026-11-12T10:00:00Z'))};
  await page();await waitFor(()=>screen.getByRole('heading',{name:'Season opens'}));
  expect(screen.getByRole('heading',{name:'News',level:1})).toBeTruthy();expect(screen.getByText('along').tagName).toBe('STRONG');expect(screen.getByText('Bring a rod').tagName).toBe('LI');
  const a=screen.getByRole('link',{name:'read more'});expect(a.getAttribute('target')).toBe('_blank');expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  expect(screen.getByText('Last updated 12 November 2026')).toBeTruthy();
 });
 it('shows only safe text even if something unsafe was saved',async()=>{
  globalThis.__news={html:'<p>Hello</p><script>window.__hacked=1</script><img src=x onerror="window.__hacked=1"><a href="javascript:window.__hacked=1">click</a>'};
  await page();await waitFor(()=>screen.getByText('Hello'));
  expect(document.querySelector('.rte script,.rte img')).toBeNull();expect(document.querySelector('.rte a')?.getAttribute('href')??null).toBeNull();expect(window.__hacked).toBeUndefined();
 });
 it('says so when there is no news yet, or the text cannot be read',async()=>{
  await page();await waitFor(()=>screen.getByText('No news yet.'));cleanup();
  globalThis.__news={html:'<p></p>'};await page();await waitFor(()=>screen.getByText('No news yet.'));cleanup();
  globalThis.__newsFail=true;await page();await waitFor(()=>screen.getByText('No news yet.'));expect(screen.getByRole('heading',{name:'News'})).toBeTruthy();
 });
 it('offers admins and superadmins an Edit news button that opens the Placeholders tab; others do not get it',async()=>{
  globalThis.__news={html:'<p>Hello</p>'};
  for(const role of ['organiser','participant']){await page(fb(role,'u1'));await waitFor(()=>screen.getByText('Hello'));expect(screen.queryByRole('link',{name:'Edit news'})).toBeNull();cleanup()}
  await page(fb('admin'));await waitFor(()=>screen.getByRole('link',{name:'Edit news'}));fireEvent.click(screen.getByRole('link',{name:'Edit news'}));
  await waitFor(()=>screen.getByRole('textbox',{name:'News text'}));expect(screen.getByRole('heading',{name:'News page'})).toBeTruthy();
 });
});
describe('Admin → Placeholders → News page',()=>{
 const open=async(role='admin')=>{app({pathname:'/admin',state:{tab:'Placeholders'}});await signIn(fb(role));return screen.findByRole('textbox',{name:'News text'})};
 const edit=box=>box.editor;
 const save=()=>screen.getByRole('button',{name:'Save'}),discard=()=>screen.getByRole('button',{name:'Discard changes'});
 const select=async box=>{await act(async()=>{edit(box).commands.selectAll()})};
 const selectFirst=async box=>{await act(async()=>{const e=edit(box);e.commands.setTextSelection({from:1,to:1+e.state.doc.firstChild.content.size})})};   // the words of the first block, as a person would select them
 const tool=n=>screen.getByRole('button',{name:n});
 it('is there for admins and superadmins, loaded with the current text, and not for anybody else',async()=>{
  globalThis.__news={html:'<h2>Season opens</h2><p>Welcome</p>'};
  const box=await open();expect(within(box).getByRole('heading',{name:'Season opens'})).toBeTruthy();expect(box.getAttribute('aria-multiline')).toBe('true');expect(box.getAttribute('contenteditable')).toBe('true');
  expect(screen.getByRole('heading',{name:'News page'})).toBeTruthy();cleanup();
  await open('superadmin');cleanup();
  app({pathname:'/admin',state:{tab:'Placeholders'}});await signIn(fb('organiser','o1'));await act(async()=>{});expect(screen.queryByRole('textbox',{name:'News text'})).toBeNull();
 });
 it('only saves when something changed, and tells the person',async()=>{
  globalThis.__news={html:'<p>Welcome</p>'};const box=await open();
  expect(save().disabled).toBe(true);expect(discard().disabled).toBe(true);expect(screen.queryByText('You have unsaved changes.')).toBeNull();
  await act(async()=>{edit(box).commands.setContent('<p>Welcome back</p>',{emitUpdate:true})});
  await waitFor(()=>expect(save().disabled).toBe(false));expect(screen.getByText('You have unsaved changes.')).toBeTruthy();
  fireEvent.click(save());await waitFor(()=>screen.getByText('Saved. The News page is updated.'));
  expect(writes).toEqual([['set','settings/news',{html:'<p>Welcome back</p>',updatedAt:'TS',updatedBy:'a1'},undefined]]);
  expect(save().disabled).toBe(true);expect(screen.queryByText('You have unsaved changes.')).toBeNull();
 });
 it('cleans the text again when saving, and saves an emptied page as empty',async()=>{
  const box=await open();await act(async()=>{edit(box).commands.setContent('<p>Hi</p>',{emitUpdate:true})});await waitFor(()=>expect(save().disabled).toBe(false));fireEvent.click(save());
  await waitFor(()=>expect(writes.length).toBe(1));cleanup();writes.length=0;
  globalThis.__news={html:'<p>Old</p>'};const b2=await open();await act(async()=>{edit(b2).commands.clearContent(true)});await waitFor(()=>expect(save().disabled).toBe(false));fireEvent.click(save());
  await waitFor(()=>expect(writes.length).toBe(1));expect(writes[0][2].html).toBe('');
 });
 it('does not save the empty line the editor keeps after a heading or list',async()=>{
  globalThis.__news={html:'<p>x</p>'};const box=await open();await select(box);fireEvent.click(tool('Heading'));
  await waitFor(()=>expect(edit(box).getHTML()).toBe('<h2>x</h2><p></p>'));await waitFor(()=>expect(save().disabled).toBe(false));fireEvent.click(save());
  await waitFor(()=>expect(writes.length).toBe(1));expect(writes[0][2].html).toBe('<h2>x</h2>');
 });
 it('discards changes and goes back to the saved text',async()=>{
  globalThis.__news={html:'<p>Welcome</p>'};const box=await open();
  await act(async()=>{edit(box).commands.setContent('<p>Something else</p>',{emitUpdate:true})});await waitFor(()=>expect(discard().disabled).toBe(false));
  fireEvent.click(discard());const back=await screen.findByRole('textbox',{name:'News text'});await waitFor(()=>expect(back.textContent).toBe('Welcome'));
  expect(save().disabled).toBe(true);expect(writes.length).toBe(0);
 });
 it('shows the reason when saving fails and keeps the changes',async()=>{
  const box=await open();await act(async()=>{edit(box).commands.setContent('<p>x</p>',{emitUpdate:true})});await waitFor(()=>expect(save().disabled).toBe(false));
  globalThis.__setDocFails=true;fireEvent.click(save());await waitFor(()=>screen.getByText('write refused'));expect(save().disabled).toBe(false);
 });
 it('refuses a text that is too long',async()=>{
  const box=await open();await act(async()=>{edit(box).commands.setContent('<p>'+'word '.repeat(MAX_HTML/4)+'</p>',{emitUpdate:true})});await waitFor(()=>expect(save().disabled).toBe(false));
  fireEvent.click(save());await waitFor(()=>screen.getByText(/too long/));expect(writes.length).toBe(0);
 });
 it('warns when another admin saved a newer version while this one is being edited, but not after its own save',async()=>{
  globalThis.__news={html:'<p>A</p>',updatedAt:ts(new Date('2026-11-10T00:00:00Z'))};const box=await open();
  expect(screen.queryByText(/Another admin saved/)).toBeNull();
  await act(async()=>{edit(box).commands.setContent('<p>mine</p>',{emitUpdate:true})});await waitFor(()=>expect(save().disabled).toBe(false));
  fireEvent.click(save());await waitFor(()=>screen.getByText(/Saved\./));
  globalThis.__news={html:'<p>mine</p>',updatedAt:ts(new Date('2026-11-18T00:00:00Z'))};await act(async()=>{globalThis.__newsSend()});
  expect(screen.queryByText(/Another admin saved/)).toBeNull();   // that was our own save arriving
  globalThis.__news={html:'<p>theirs</p>',updatedAt:ts(new Date('2026-11-19T00:00:00Z'))};await act(async()=>{globalThis.__newsSend()});
  await waitFor(()=>screen.getByText(/Another admin saved a newer version/));expect(edit(box).getHTML()).toBe('<p>mine</p>');   // the editor keeps what is being typed
 });
 describe('the formatting buttons',()=>{
  const fmt=async(name,html,check)=>{globalThis.__news={html};const box=await open();await selectFirst(box);
   fireEvent.click(tool(name));await waitFor(()=>check(edit(box).getHTML()));return box};
  it('Heading and Subheading',async()=>{
   const box=await fmt('Heading','<p>Title</p>',h=>expect(h).toBe('<h2>Title</h2><p></p>'));   // the empty line after it is for typing onexpect(tool('Heading').getAttribute('aria-pressed')).toBe('true');
   fireEvent.click(tool('Subheading'));await waitFor(()=>expect(edit(box).getHTML()).toBe('<h3>Title</h3><p></p>'));expect(tool('Heading').getAttribute('aria-pressed')).toBe('false');
   fireEvent.click(tool('Subheading'));await waitFor(()=>expect(edit(box).getHTML()).toBe('<p>Title</p><p></p>'));   // pressing it again takes it off
  });
  it('Bold, Italic and Underline',async()=>{
   const box=await fmt('Bold','<p>Words</p>',h=>expect(h).toBe('<p><strong>Words</strong></p>'));
   fireEvent.click(tool('Italic'));fireEvent.click(tool('Underline'));await waitFor(()=>expect(edit(box).getHTML()).toMatch(/<u>/));
   expect(edit(box).getHTML()).toMatch(/<em>/);['Bold','Italic','Underline'].forEach(n=>expect(tool(n).getAttribute('aria-pressed')).toBe('true'));
   fireEvent.click(tool('Bold'));await waitFor(()=>expect(edit(box).getHTML()).not.toMatch(/<strong>/));expect(tool('Bold').getAttribute('aria-pressed')).toBe('false');
  });
  it('Bulleted list, Numbered list and Quote',async()=>{
   const box=await fmt('Bulleted list','<p>One</p>',h=>expect(h).toBe('<ul><li><p>One</p></li></ul><p></p>'));
   fireEvent.click(tool('Numbered list'));await waitFor(()=>expect(edit(box).getHTML()).toBe('<ol><li><p>One</p></li></ol><p></p>'));
   fireEvent.click(tool('Numbered list'));await waitFor(()=>expect(edit(box).getHTML()).toBe('<p>One</p><p></p>'));
   fireEvent.click(tool('Quote'));await waitFor(()=>expect(edit(box).getHTML()).toBe('<blockquote><p>One</p></blockquote><p></p>'));
  });
  it('Undo and Redo, which are off until there is something to undo or redo',async()=>{
   globalThis.__news={html:'<p>Words</p>'};const box=await open();expect(tool('Undo').disabled).toBe(true);expect(tool('Redo').disabled).toBe(true);
   await select(box);fireEvent.click(tool('Bold'));await waitFor(()=>expect(tool('Undo').disabled).toBe(false));
   fireEvent.click(tool('Undo'));await waitFor(()=>expect(edit(box).getHTML()).toBe('<p>Words</p>'));expect(tool('Redo').disabled).toBe(false);
   fireEvent.click(tool('Redo'));await waitFor(()=>expect(edit(box).getHTML()).toMatch(/<strong>/));
  });
  it('is a toolbar with named buttons, which keep the selection when pressed with the mouse',async()=>{
   await open();const bar=screen.getByRole('toolbar',{name:'Text formatting'});
   expect([...bar.querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))).toEqual(['Heading','Subheading','Bold','Italic','Underline','Bulleted list','Numbered list','Quote','Link','Undo','Redo']);
   const down=new MouseEvent('mousedown',{bubbles:true,cancelable:true});tool('Bold').dispatchEvent(down);expect(down.defaultPrevented).toBe(true);
  });
 });
 describe('links',()=>{
  const withText=async()=>{globalThis.__news={html:'<p>Read more here</p>'};const box=await open();await select(box);return box};
  const apply=v=>{fireEvent.change(screen.getByLabelText('Web address'),{target:{value:v}});fireEvent.click(screen.getByRole('button',{name:'Apply'}))};
  it('makes the selected words a link that opens in a new tab',async()=>{
   const box=await withText();fireEvent.click(tool('Link'));expect(tool('Link').getAttribute('aria-expanded')).toBe('true');apply('example.com');
   await waitFor(()=>expect(edit(box).getHTML()).toBe('<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Read more here</a></p>'.replace(' nofollow','')));
   expect(screen.queryByLabelText('Web address')).toBeNull();expect(tool('Link').getAttribute('aria-pressed')).toBe('true');
  });
  it('takes an email address, and Enter in the box applies it',async()=>{
   const box=await withText();fireEvent.click(tool('Link'));fireEvent.change(screen.getByLabelText('Web address'),{target:{value:'me@example.com'}});fireEvent.keyDown(screen.getByLabelText('Web address'),{key:'Enter'});
   await waitFor(()=>expect(edit(box).getHTML()).toContain('href="mailto:me@example.com"'));
  });
  it('explains a bad address and a missing selection, and changes nothing',async()=>{
   const box=await withText();fireEvent.click(tool('Link'));apply('javascript:alert(1)');
   await waitFor(()=>screen.getByRole('alert'));expect(screen.getByRole('alert').textContent).toMatch(/web address such as https:\/\/example\.com/);expect(edit(box).getHTML()).toBe('<p>Read more here</p>');
   await act(async()=>{edit(box).commands.setTextSelection(3)});apply('example.com');await waitFor(()=>expect(screen.getByRole('alert').textContent).toMatch(/Select the words/));expect(edit(box).getHTML()).toBe('<p>Read more here</p>');
  });
  it('shows the current address of a link, and can remove it',async()=>{
   globalThis.__news={html:'<p><a href="https://example.com/old">Old link</a></p>'};const box=await open();
   await act(async()=>{edit(box).commands.setTextSelection(3)});fireEvent.click(tool('Link'));
   expect(screen.getByLabelText('Web address').value).toBe('https://example.com/old');
   fireEvent.click(screen.getByRole('button',{name:'Remove link'}));await waitFor(()=>expect(edit(box).getHTML()).toBe('<p>Old link</p>'));expect(screen.queryByLabelText('Web address')).toBeNull();
  });
 });
 it('drops anything the editor does not offer, such as scripts, pictures and styles, when it is pasted or inserted',async()=>{
  const box=await open();await act(async()=>{edit(box).commands.insertContent('<p style="color:red">Hi</p><script>x</script><img src="https://x.test/a.png"><iframe src="https://x.test"></iframe><pre><code>code</code></pre><h4>four</h4>')});
  const h=edit(box).getHTML();expect(h).not.toMatch(/script|<img|iframe|style=|<pre|<code|<h4/);expect(h).toContain('Hi');
 });
});
