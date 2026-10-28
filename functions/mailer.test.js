const test=require('node:test');
const assert=require('node:assert');
const {makeMailer}=require('./mailer');
// A tiny in-memory Firestore with transactions, and a fake SMTP transport.
function setup({replyTo='',results=[]}={}){
 const m=new Map(),clone=x=>structuredClone(x);
 const ref=p=>({path:p,update:async d=>{if(!m.has(p))throw new Error('NOT_FOUND');m.set(p,{...m.get(p),...clone(d)})}});
 const db={async runTransaction(fn){const pend=[];const tx={get:async r=>({exists:m.has(r.path),data:()=>clone(m.get(r.path))}),update:(r,d)=>pend.push(()=>m.set(r.path,{...m.get(r.path),...clone(d)}))};const out=await fn(tx);pend.forEach(f=>f());return out}};
 const sent=[],waits=[];let call=0;
 const transport={sendMail:async o=>{sent.push(o);const r=results[call++];if(r instanceof Error)throw r;return r||{messageId:'<id1@x>',accepted:[].concat(o.to),rejected:[],response:'250 OK'}}};
 const mailer=makeMailer({db,ts:()=>'TS',getTransport:()=>transport,from:()=>'Fishing League <events@fishingleague.co.nz>',replyTo:()=>replyTo,sleep:async ms=>{waits.push(ms)}});
 const put=(data,id='m1')=>{m.set('mail/'+id,data);return ref('mail/'+id)};
 return {mailer,put,sent,waits,get:id=>m.get('mail/'+(id||'m1'))};
}
const GOOD={to:'pat@example.com',message:{subject:'Registration confirmed',text:'See you at the lake.'}};
const err=(code,extra={})=>Object.assign(new Error('smtp '+code),{code,...extra});
test('sends the email from the fixed sender and records the result',async()=>{
 const x=setup({replyTo:'club@gmail.com'});const r=x.put(GOOD);
 assert.equal(await x.mailer.send(r),'sent');
 assert.deepEqual(x.sent,[{from:'Fishing League <events@fishingleague.co.nz>',to:['pat@example.com'],subject:'Registration confirmed',text:'See you at the lake.',html:undefined,replyTo:'club@gmail.com'}]);
 const d=x.get().delivery;assert.equal(d.state,'SUCCESS');assert.equal(d.attempts,1);assert.equal(d.error,null);assert.deepEqual(d.info,{messageId:'<id1@x>',accepted:['pat@example.com'],rejected:[],response:'250 OK'});
});
test('no reply-to header when none is set; a sender or reply-to in the document is ignored',async()=>{
 const x=setup();const r=x.put({...GOOD,from:'evil@x.com',replyTo:'evil@x.com',message:{...GOOD.message,from:'evil@x.com'}});
 await x.mailer.send(r);assert.equal(x.sent[0].from,'Fishing League <events@fishingleague.co.nz>');assert.ok(!('replyTo' in x.sent[0]));
});
test('accepts several recipients and an html body',async()=>{
 const x=setup();await x.mailer.send(x.put({to:['a@example.com',' b@example.com '],message:{subject:'Hi',html:'<b>Hi</b>'}}));
 assert.deepEqual(x.sent[0].to,['a@example.com','b@example.com']);assert.equal(x.sent[0].html,'<b>Hi</b>');assert.equal(x.get().delivery.state,'SUCCESS');
});
test('refuses bad recipients, a missing subject or an empty body, without sending',async()=>{
 const bad=[{to:''},{to:'nobody'},{to:'Pat <pat@example.com>'},{to:'"a;b"@example.com'},{to:'a@example.com;b@example.com'},{to:'a@example.com,b@example.com'},{to:['a@example.com','x y@example.com']},{to:Array.from({length:11},(_,i)=>`u${i}@example.com`)},{to:null},
  {to:'a@example.com',message:{subject:'',text:'x'}},{to:'a@example.com',message:{text:'x'}},{to:'a@example.com',message:{subject:'x'.repeat(201),text:'x'}},{to:'a@example.com',message:{subject:'Hi',text:'  '}},{to:'a@example.com',message:null}];
 for(const b of bad){const x=setup();const d={message:{subject:'Hi',text:'Body'},...b};assert.equal(await x.mailer.send(x.put(d)),'error',JSON.stringify(b));assert.equal(x.sent.length,0);assert.equal(x.get().delivery.state,'ERROR');assert.ok(x.get().delivery.error)}
});
test('a document that already has a delivery result is never sent again (duplicate events)',async()=>{
 const x=setup();const r=x.put({...GOOD,delivery:{state:'SUCCESS'}});assert.equal(await x.mailer.send(r),'skipped');assert.equal(x.sent.length,0);
 const y=setup();const r2=y.put(GOOD);await y.mailer.send(r2);await y.mailer.send(r2);assert.equal(y.sent.length,1);
 assert.equal(await y.mailer.send({path:'mail/gone'}),'skipped');   // deleted before it ran
});
test('retries a temporary failure, then succeeds',async()=>{
 const x=setup({results:[err('ETIMEDOUT'),Object.assign(new Error('try later'),{responseCode:421})]});
 assert.equal(await x.mailer.send(x.put(GOOD)),'sent');assert.equal(x.sent.length,3);assert.deepEqual(x.waits,[1000,3000]);assert.equal(x.get().delivery.attempts,3);assert.equal(x.get().delivery.state,'SUCCESS');
});
test('gives up after three temporary failures, and records the error',async()=>{
 const x=setup({results:[err('ECONNECTION'),err('ECONNECTION'),err('ECONNECTION'),err('ECONNECTION')]});
 assert.equal(await x.mailer.send(x.put(GOOD)),'error');assert.equal(x.sent.length,3);const d=x.get().delivery;assert.deepEqual([d.state,d.attempts,d.error],['ERROR',3,'smtp ECONNECTION']);
});
test('a permanent failure (wrong login, refused address) is not retried',async()=>{
 const x=setup({results:[err('EAUTH',{responseCode:535})]});
 assert.equal(await x.mailer.send(x.put(GOOD)),'error');assert.equal(x.sent.length,1);assert.deepEqual(x.waits,[]);assert.equal(x.get().delivery.attempts,1);assert.match(x.get().delivery.error,/EAUTH/);
 const y=setup({results:[Object.assign(new Error('550 mailbox unavailable'),{responseCode:550})]});await y.mailer.send(y.put(GOOD));assert.equal(y.sent.length,1);
});
test('an email where every recipient was rejected counts as an error; one rejected out of two is still a success',async()=>{
 const x=setup({results:[{messageId:'1',accepted:[],rejected:['pat@example.com'],response:'550'}]});await x.mailer.send(x.put(GOOD));assert.equal(x.get().delivery.state,'ERROR');
 const y=setup({results:[{messageId:'1',accepted:['a@example.com'],rejected:['b@example.com'],response:'250'}]});await y.mailer.send(y.put({to:['a@example.com','b@example.com'],message:{subject:'Hi',text:'x'}}));
 assert.equal(y.get().delivery.state,'SUCCESS');assert.deepEqual(y.get().delivery.info.rejected,['b@example.com']);
});
