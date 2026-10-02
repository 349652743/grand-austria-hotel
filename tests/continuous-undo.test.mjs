import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {createGame,act,view} from '../engine.mjs';
import {actor,decide} from './bot.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local/tests/continuous-undo');
const seats=[{id:'p0',name:'甲',token:'a'.repeat(64),ready:true},{id:'p1',name:'乙',token:'b'.repeat(64),ready:true}];
function ready(){let g=createGame(seats,9876);for(let i=0;i<20&&g.phase==='setup';i++)g=act(g,actor(g),decide(g));assert.equal(g.phase,'playing');return g;}
function die(g){const face=[1,2,4,6].find(f=>g.dice[f-1]);return {type:'die',face,...(face===6?{target:4}:{})};}
async function fixture(t,game,extras={}){
 await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'http-')),save=path.join(dir,'rooms.json');
 await writeFile(save,JSON.stringify({ABCDEF:{code:'ABCDEF',host:'p0',created:1,revision:0,seats,receipts:{},game,...extras}}));
 let app,base,seq=0;
 const start=async()=>{app=await createApp({dataDir:dir,rateLimit:100000});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;};await start();
 t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});
 const request=async(p,body)=>{const r=await fetch(`${base}/api/rooms/ABCDEF${body?'/action':''}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${seats.find(s=>s.id===p).token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});return {status:r.status,data:await r.json()};};
 const state=async p=>(await request(p)).data;
 return {state,action:async(p,action,id=`continuous-${++seq}`,revision)=>(await request(p,{action,requestId:id,revision:revision??(await state(p)).revision})),raw:async()=>JSON.parse(await readFile(save,'utf8')).ABCDEF,restart:async()=>{await app.close();await start();}};
}
test('legacy single snapshot survives load, append, persistence and restart',async t=>{
 for(const append of [false,true])await t.test(`append=${append}`,async t=>{
  const g=ready(),p=actor(g),first=act(g,p,die(g));
  const f=await fixture(t,first,{revision:1,undoHistory:{player:p,game:g},receipts:{[`${p}:legacy-original`]:1}});
  assert.equal((await f.state(p)).undo.remaining,1);
  if(append){const r=await f.action(p,decide(first));assert.equal(r.status,200);assert.equal(r.data.undo.remaining,2);await f.restart();const undone=await f.action(p,{type:'undo'});assert.equal(undone.status,200);assert.deepEqual(undone.data.game,view(first,p));}
  const undone=await f.action(p,{type:'undo'});assert.equal(undone.status,200);assert.deepEqual(undone.data.game,view(g,p));assert.equal(undone.data.undo.remaining,0);
  await f.restart();assert.equal((await f.action(p,{type:'undo'})).status,400);
  const replay=await f.action(p,die(g),'legacy-original',0);assert.equal(replay.status,200);assert.equal(replay.data.revision,append?4:2);assert.deepEqual(replay.data.game,view(g,p));
  const raw=await f.raw();assert.deepEqual(raw.undoStack,[]);assert.equal(raw.undoHistory,null);
 });
});

// Controlled legal pending-resolution fixture: six effects remain in one player's turn.
function chain(effects=Array.from({length:6},()=>({type:'funds',n:1}))){
 const g=ready(),p=actor(g);g.turn.main=true;g.turn.touched=true;
 g.pending=[{owner:p,label:'continuous undo regression',effects}];return g;
}
test('six safe HTTP actions retain linear snapshots, undo six times, and keep spent receipts',async t=>{
 const initial=chain(),p=actor(initial),q=seats.find(s=>s.id!==p).id,f=await fixture(t,initial),states=[initial];
 const action={type:'resolve',index:0,favor:0};
 for(let i=0;i<6;i++){
  const r=await f.action(p,action,`safe-step-${i}`);assert.equal(r.status,200);assert.equal(r.data.undo.remaining,i+1);
  states.push(act(states.at(-1),p,action));assert.deepEqual(r.data.game,view(states.at(-1),p));
  assert.equal((await f.state(q)).undo.remaining,0);
 }
 const raw=await f.raw();assert.equal(raw.undoStack.length,6);
 for(const h of raw.undoStack){assert.deepEqual(Object.keys(h).sort(),['game','player']);assert.equal(h.game.undoStack,undefined);assert.equal(h.game.undoHistory,undefined);}
 const snapshotBytes=Buffer.byteLength(JSON.stringify(raw.undoStack));
 assert.ok(snapshotBytes<7*Math.max(...states.map(g=>Buffer.byteLength(JSON.stringify(g)))),'history grows linearly, not recursively');
 await f.restart();assert.equal((await f.state(p)).undo.remaining,6);
 for(let i=5;i>=0;i--){const r=await f.action(p,{type:'undo'});assert.equal(r.status,200);assert.equal(r.data.revision,12-i);assert.equal(r.data.undo.remaining,i);assert.deepEqual(r.data.game,view(states[i],p));}
 assert.equal((await f.action(p,{type:'undo'})).status,400);await f.restart();
 for(let i=0;i<6;i++){const r=await f.action(p,action,`safe-step-${i}`,i);assert.equal(r.status,200);assert.equal(r.data.revision,12);assert.deepEqual(r.data.game,view(initial,p));}
 assert.deepEqual((await f.raw()).undoStack,[]);
});
test('undo then alternate branch never resurrects abandoned future or old request IDs',async t=>{
 const g=chain(),p=actor(g),f=await fixture(t,g),a={type:'resolve',index:0,favor:0};
 const first=act(g,p,a);await f.action(p,a,'branch-first');await f.action(p,a,'branch-abandoned');
 assert.equal((await f.action(p,{type:'undo'})).data.undo.remaining,1);
 const alternative={...a,favor:1},branched=act(first,p,alternative),r=await f.action(p,alternative,'branch-new');
 assert.equal(r.status,200);assert.equal(r.data.undo.remaining,2);assert.deepEqual(r.data.game,view(branched,p));
 const replay=await f.action(p,a,'branch-abandoned',1);assert.equal(replay.data.revision,4);assert.deepEqual(replay.data.game,view(branched,p));
 await f.restart();for(const expected of [first,g]){const undo=await f.action(p,{type:'undo'});assert.equal(undo.status,200);assert.deepEqual(undo.data.game,view(expected,p));}
 assert.equal((await f.action(p,{type:'undo'})).status,400);
});
test('hidden draw clears the entire stack and a new safe interval starts after it',async t=>{
 const funds={type:'funds',n:1},g=chain([funds,funds,{type:'draw',n:1},funds]),p=actor(g),f=await fixture(t,g),a={type:'resolve',index:0,favor:0};
 await f.action(p,a);assert.equal((await f.action(p,a)).data.undo.remaining,2);
 const revealed=await f.action(p,{type:'resolve',index:0});assert.equal(revealed.status,200);assert.equal(revealed.data.undo.remaining,0);assert.equal(revealed.data.undo.available,false);
 assert.deepEqual((await f.raw()).undoStack,[]);await f.restart();assert.equal((await f.action(p,{type:'undo'})).status,400);
 const safe=await f.action(p,a);assert.equal(safe.status,200);assert.equal(safe.data.undo.remaining,1);
 const undone=await f.action(p,{type:'undo'});assert.equal(undone.status,200);assert.deepEqual(undone.data.game,revealed.data.game);assert.equal(undone.data.undo.remaining,0);
 assert.equal((await f.action(p,{type:'undo'})).status,400);
});
test('ending a turn drops all six snapshots, including after restart',async t=>{
 const g=chain(),p=actor(g),f=await fixture(t,g);
 for(let i=0;i<6;i++)assert.equal((await f.action(p,{type:'resolve',index:0,favor:0})).status,200);
 assert.equal((await f.state(p)).undo.remaining,6);
 const ended=await f.action(p,{type:'end'});assert.equal(ended.status,200);assert.equal(ended.data.undo.remaining,0);
 assert.deepEqual((await f.raw()).undoStack,[]);await f.restart();assert.equal((await f.action(p,{type:'undo'})).status,400);
});
test('safe public check-in retains earlier history and restores room guest records over HTTP',async t=>{
 const g=chain([{type:'funds',n:1}]),p=actor(g),player=g.players.find(x=>x.id===p);
 player.rooms[0]=1;player.roomGuests[0]=null;player.cafe=[{id:92,served:[1,0,0,0]}];
 const f=await fixture(t,g),first=await f.action(p,{type:'resolve',index:0,favor:0});assert.equal(first.status,200);assert.equal(first.data.undo.remaining,1);
 const checked=await f.action(p,{type:'checkin',guest:92,room:0});assert.equal(checked.status,200);assert.equal(checked.data.game.players.find(x=>x.id===p).roomGuests[0],92);assert.equal(checked.data.undo.remaining,2,'public check-in must retain safe earlier history');
 await f.restart();
 for(const expected of [first.data.game,view(g,p)]){const undone=await f.action(p,{type:'undo'});assert.equal(undone.status,200);assert.deepEqual(undone.data.game,expected);}
 assert.equal((await f.state(p)).undo.remaining,0);
});

test('explicit empty stack never resurrects a leftover legacy snapshot',async t=>{
 const g=ready(),p=actor(g),f=await fixture(t,act(g,p,die(g)),{undoStack:[],undoHistory:{player:p,game:g}});
 assert.equal((await f.state(p)).undo.remaining,0);assert.equal((await f.action(p,{type:'undo'})).status,400);
});
