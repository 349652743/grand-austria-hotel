import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {createGame,act,view} from '../engine.mjs';
import {actor,decide} from './bot.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local/tests/undo');
const seats=[{id:'p0',name:'甲',token:'a'.repeat(64),ready:true},{id:'p1',name:'乙',token:'b'.repeat(64),ready:true}];
function ready(seed=9876){let g=createGame(seats,seed);while(g.phase==='setup')g=act(g,actor(g),decide(g));return g;}
async function fixture(t,game=ready(),extras={}){
 await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'http-'));
 await writeFile(path.join(dir,'rooms.json'),JSON.stringify({ABCDEF:{code:'ABCDEF',host:'p0',created:1,revision:0,seats,receipts:{},game,...extras}}));
 let app,base,seq=0;
 const start=async()=>{app=await createApp({dataDir:dir,rateLimit:100000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};await start();
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const request=async(player,suffix='',body)=>{const r=await fetch(`${base}/api/rooms/ABCDEF${suffix}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${seats.find(s=>s.id===player)?.token||'invalid'}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
 const state=async p=>(await request(p)).data;
 const action=async(p,a,revision,requestId=`undo-test-${++seq}`)=>request(p,'/action',{action:a,revision:revision??(await state(p)).revision,requestId});
 return {dir,state,action,request,restart:async()=>{await app.close();await start();},events:async p=>fetch(`${base}/api/rooms/ABCDEF/events`,{headers:{Authorization:`Bearer ${seats.find(s=>s.id===p).token}`}})};
}
function legalPath(predicate){
 for(let seed=1;seed<=80;seed++){let g=createGame(seats,seed*10213);for(let i=0;i<2000&&g.phase!=='finished';i++){const p=actor(g),a=decide(g),after=act(g,p,a);if(predicate(g,a,after))return {g,p,a,after};g=after;}}
 throw new Error('No legal engine path for fixture');
}
test('authentication, other seats, stale revision, invalid commands and undo replay',async t=>{
 const g=ready(),p=actor(g),q=seats.find(s=>s.id!==p).id,f=await fixture(t,g);
 const changed=await f.action(p,safeDie(g),0,'original-die');assert.equal(changed.status,200);
 assert.equal((await f.state(q)).undo.available,false);
 assert.equal((await f.action('outsider',{type:'undo'},1)).status,401);
 assert.equal((await f.action(q,{type:'undo'},1)).status,400);
 assert.equal((await f.action(p,{type:'undo'},0)).status,409);
 assert.equal((await f.action(p,{type:'undo'},1,'bad')).status,400);
 assert.equal((await f.action(p,{type:'unknown'},1)).status,400);
 assert.equal((await f.state(p)).undo.available,true);
 const results=await Promise.all([f.action(p,{type:'undo'},1,'concurrent-one'),f.action(p,{type:'undo'},1,'concurrent-two')]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results[0].status===200?'concurrent-one':'concurrent-two';
 for(const [a,id,rev] of [[safeDie(g),'original-die',0],[{type:'undo'},winner,1]]){const r=await f.action(p,a,rev,id);assert.equal(r.status,200);assert.equal(r.data.revision,2);assert.deepEqual(r.data.game,view(g,p));}
});
test('consumed request IDs remain spent beyond the old 1000-receipt window',async t=>{
 const g=ready(),p=actor(g),receipts=Object.fromEntries(Array.from({length:1000},(_,i)=>[`${p}:historical-${i}`,i+1]));
 const f=await fixture(t,g,{receipts,revision:1000});
 await f.action(p,safeDie(g));await f.action(p,{type:'undo'});
 const r=await f.action(p,safeDie(g),1002,'historical-0');assert.equal(r.status,200);assert.equal(r.data.revision,1002);assert.deepEqual(r.data.game,view(g,p));
});
test('current-turn stack persists, restores twice after restart, and never leaks via HTTP/SSE',async t=>{
 const g=ready(),p=actor(g),q=seats.find(s=>s.id!==p).id,f=await fixture(t,g);
 const first=act(g,p,safeDie(g));assert.equal((await f.action(p,safeDie(g))).status,200);
 const next=decide(first),second=await f.action(p,next);assert.equal(second.status,200);assert.equal(second.data.undo.available,true);
 const raw=JSON.parse(await readFile(path.join(f.dir,'rooms.json'),'utf8')).ABCDEF;
 assert.equal(raw.undoStack.length,2);for(const h of raw.undoStack){assert.deepEqual(Object.keys(h).sort(),['game','player']);assert.equal(h.game.undoHistory,undefined);assert.equal(h.game.undoStack,undefined);}assert.deepEqual(raw.undoStack[1].game,first);
 await f.restart();assert.equal((await f.state(p)).undo.available,true);
 const streams=[];
 async function listen(who){const response=await f.events(who),reader=response.body.getReader();streams.push(reader);let buffer='';return async revision=>{for(;;){let cut;while((cut=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,cut);buffer=buffer.slice(cut+2);const data=frame.split('\n').find(l=>l.startsWith('data: '));if(data){const value=JSON.parse(data.slice(6));if(value.revision===revision)return value;}}const {value,done}=await reader.read();assert.equal(done,false);buffer+=new TextDecoder().decode(value);}};}
 const ownerStream=await listen(p),otherStream=await listen(q);t.after(()=>Promise.all(streams.map(r=>r.cancel().catch(()=>{}))));
 const r=await f.action(p,{type:'undo'});assert.equal(r.status,200);assert.deepEqual(r.data.game,view(first,p));
 const states=await Promise.all([ownerStream(3),otherStream(3),f.state(p),f.state(q)]);
 for(const s of states){assert.equal(s.revision,3);assert.equal(s.undo.available,s.you===p);assert.equal(s.undo.remaining,s.you===p?1:0);assert.equal(s.undoStack,undefined);assert.equal(s.undoHistory,undefined);assert.equal(s.receipts,undefined);assert.equal(s.game.undoHistory,undefined);assert.equal(s.game.undoStack,undefined);assert.equal(s.game.rng,undefined);assert.equal(s.game.staffDeck,undefined);assert.ok(s.seats.every(x=>!x.token));assert.ok(s.game.players.every(x=>x.id===s.you||x.hand===undefined));assert.ok(!JSON.stringify(s).includes(seats[0].token));}
 await Promise.all(streams.map(r=>r.cancel()));await f.restart();const last=await f.action(p,{type:'undo'});assert.equal(last.status,200);assert.deepEqual(last.data.game,view(g,p));assert.equal(last.data.undo.remaining,0);assert.equal((await f.action(p,{type:'undo'})).status,400);
});
test('food allocation and funds resolution undo to exact legal engine state',async t=>{
 const cases=[legalPath((g,a)=>g.phase==='playing'&&a.type==='serve'),legalPath((g,a)=>g.phase==='playing'&&g.pending[0]?.effects[a.index]?.type==='funds'),legalPath((g,a)=>g.phase==='playing'&&g.pending[0]?.effects[a.index]?.type==='dishes')];
 for(const {g,p,a,after} of cases){const f=await fixture(t,g),r=await f.action(p,a);assert.equal(r.status,200);assert.deepEqual(r.data.game,view(after,p));assert.equal(r.data.undo.available,true);const undo=await f.action(p,{type:'undo'});assert.equal(undo.status,200);assert.deepEqual(undo.data.game,view(g,p));}
});
test('hidden action clears rather than exposes older safe history',async t=>{
 const {g,p,a}=legalPath((g,a)=>g.phase==='playing'&&a.type==='serve'&&!g.turn.guest&&!g.turn.main&&g.players.find(x=>x.id===actor(g)).cafe.length<3);
 const f=await fixture(t,g);assert.equal((await f.action(p,a)).data.undo.available,true);
 const r=await f.action(p,{type:'guest',guest:4});assert.equal(r.status,200);assert.equal(r.data.undo.available,false);assert.equal((await f.action(p,{type:'undo'})).status,400);
 await f.restart();assert.equal((await f.state(p)).undo.available,false);
});
test('passing and re-rolling cannot be undone',async t=>{
 let g=ready();for(let i=0;i<2;i++){const p=actor(g),f=await fixture(t,g),r=await f.action(p,{type:'pass'});assert.equal(r.status,200);assert.equal(r.data.undo.available,false);assert.equal((await f.action(p,{type:'undo'})).status,400);g=act(g,p,{type:'pass'});}
});
function safeDie(g){const face=[1,2,4,6].find(f=>g.dice[f-1]>0);assert.ok(face);return {type:'die',face,...(face===6?{target:4}:{})};}
test('one recorded action restores exactly once and revision increases',async t=>{
 const g=ready(),p=actor(g),f=await fixture(t,g),before=await f.state(p);
 assert.deepEqual(before.undo,{available:false,reason:'没有可撤销的操作',remaining:0});
 const a=safeDie(g),changed=await f.action(p,a);assert.equal(changed.status,200);assert.equal(changed.data.undo.available,true);
 const undone=await f.action(p,{type:'undo'});assert.equal(undone.status,200);assert.deepEqual(undone.data.game,view(g,p));assert.equal(undone.data.revision,2);assert.equal(undone.data.undo.available,false);
 assert.equal((await f.action(p,{type:'undo'})).status,400);
 const raw=JSON.parse(await readFile(path.join(f.dir,'rooms.json'),'utf8')).ABCDEF;assert.equal(raw.undoHistory,null);assert.deepEqual(raw.seats,seats);assert.equal(Object.keys(raw.receipts).length,2);
});

test('hidden information barriers: guest refill, draw and private offer',async t=>{
 const cases=[
  {label:'guest refill',...(()=>{const g=ready();return {g,p:actor(g),a:{type:'guest',guest:4}};})()},
  {label:'staff draw',...legalPath((g,a)=>g.phase==='playing'&&g.pending[0]?.effects[a.index]?.type==='draw'&&!a.skip)},
  {label:'private offer',...legalPath((g,a)=>g.phase==='playing'&&g.pending[0]?.effects[a.index]?.type==='offer'&&!g.pending[0].effects[a.index].cards&&!a.skip)}
 ];
 for(const {label,g,p,a} of cases){const f=await fixture(t,g,{undoStack:[{player:p,game:g},{player:p,game:g}]}),r=await f.action(p,a);assert.equal(r.status,200,label);assert.equal(r.data.undo.available,false,label);assert.equal(r.data.undo.remaining,0);assert.match(r.data.undo.reason,/信息/);assert.equal((await f.action(p,{type:'undo'})).status,400);const raw=JSON.parse(await readFile(path.join(f.dir,'rooms.json'),'utf8')).ABCDEF;assert.deepEqual(raw.undoStack,[]);}
});
test('setup, turn slot, round, emperor and game-end transitions discard history',async t=>{
 const cases=[
  legalPath(g=>g.phase==='setup'),
  legalPath((g,a,n)=>a.type==='end'&&g.turn.player===n.turn?.player&&g.turn.slot!==n.turn.slot),
  legalPath((g,a,n)=>a.type==='end'&&n.turn?.player!==g.turn.player),
  legalPath((g,a,n)=>g.round!==n.round),
  legalPath((g,a,n)=>g.phase==='playing'&&n.phase==='emperor'),
  legalPath((g,a,n)=>g.phase==='emperor'&&n.phase==='finished')
 ];
 for(const {g,p,a} of cases){const f=await fixture(t,g,{undoStack:[{player:p,game:g},{player:p,game:g}]});const r=await f.action(p,a);assert.equal(r.status,200);assert.equal(r.data.undo.available,false,JSON.stringify({a,phase:g.phase,round:g.round}));assert.equal(r.data.undo.remaining,0);assert.equal((await f.action(p,{type:'undo'})).status,400);const raw=JSON.parse(await readFile(path.join(f.dir,'rooms.json'),'utf8')).ABCDEF;assert.equal(raw.undoHistory,null);assert.deepEqual(raw.undoStack,[]);}
});
