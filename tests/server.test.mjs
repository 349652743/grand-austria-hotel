import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {actor,decide} from './bot.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local/tests/security');
await mkdir(root,{recursive:true});
const tmp=await mkdtemp(path.join(root,'server-'));
let app=await createApp({dataDir:tmp,rateLimit:10000});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
let base=`http://127.0.0.1:${app.server.address().port}`;
const request=async(url,{body,token,headers={}}={})=>{const r=await fetch(base+url,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} :{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
let sequence=0;
const create=name=>request('/api/rooms',{body:{name}}).then(r=>r.data);
const state=s=>request(`/api/rooms/${s.code}`,{token:s.token}).then(r=>r.data);
const action=async(s,a,revision,requestId=`request-${++sequence}`)=>request(`/api/rooms/${s.code}/action`,{token:s.token,body:{action:a,revision:revision??(await state(s)).revision,requestId}});
test('HTTP authority, replay protection, ready state and privacy',async()=>{
 const host=await create('房主'),guest=(await request(`/api/rooms/${host.code}/join`,{body:{name:'朋友'}})).data;
 assert.equal((await request(`/api/rooms/${host.code}`)).status,401);
 assert.equal((await request(`/api/rooms/${host.code}`,{token:'x'.repeat(64)})).status,401);
 assert.equal((await request('/api/rooms',{body:{name:'Bad'},headers:{Origin:'https://example.org'}})).status,403);
 assert.equal((await action(guest,{type:'start'})).status,400);
 assert.equal((await action(host,{type:'start'})).status,400);
 const revision=(await state(guest)).revision;const id='idempotent-test-0001';
 assert.equal((await action(guest,{type:'ready'},revision,id)).status,200);
 assert.equal((await action(guest,{type:'ready'},revision,id)).status,200);
 assert.equal((await state(guest)).seats.find(s=>s.id===guest.player).ready,true);
 assert.equal((await action(host,{type:'ready'},revision)).status,409);
 assert.equal((await action(host,{type:'start'})).status,200);
 assert.equal((await request(`/api/rooms/${host.code}/join`,{body:{name:'迟到者'}})).status,400);
 const v=await state(host);assert.ok(v.game.players.find(p=>p.id===host.player).hand);assert.equal(v.game.players.find(p=>p.id===guest.player).hand,undefined);assert.equal(v.game.rng,undefined);assert.ok(v.seats.every(s=>!s.token));
 const raw=JSON.parse(await readFile(path.join(tmp,'rooms.json'),'utf8'));assert.ok(raw[host.code].game.staffDeck.length>0);
 await app.close();app=await createApp({dataDir:tmp,rateLimit:10000});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;
 assert.deepEqual((await state(host)).game,v.game,'Persisted game restores exactly after server recreation');
});
test('2, 3 and 4-player matches complete seven rounds over real HTTP',async()=>{
 for(const n of [2,3,4]){
  const host=await create(`Host${n}`),players=[host];
  for(let i=1;i<n;i++){const s=(await request(`/api/rooms/${host.code}/join`,{body:{name:`Guest${n}-${i}`}})).data;players.push(s);assert.equal((await action(s,{type:'ready'})).status,200);}
  if(n===4)assert.equal((await request(`/api/rooms/${host.code}/join`,{body:{name:'Fifth'}})).status,400);
  assert.equal((await action(host,{type:'start'})).status,200);let v=await state(host),steps=0;
  while(v.game.phase!=='finished'&&steps++<3000){const s=players.find(s=>s.player===actor(v.game));v=await state(s);const choice=decide(v.game);const r=await action(s,choice,v.revision);assert.equal(r.status,200,JSON.stringify({choice,error:r.data,phase:v.game.phase}));v=r.data;}
  assert.equal(v.game.phase,'finished');assert.equal(v.game.round,7);const snapshots=await Promise.all(players.map(state));assert.ok(snapshots.every(s=>s.revision===v.revision));assert.ok(snapshots.every(s=>JSON.stringify(s.game.winners)===JSON.stringify(v.game.winners)));console.log(`HTTP match ${n} players: ${steps} commands, revision ${v.revision}`);
 }
});
test.after(async()=>{await app.close();const resolved=path.resolve(tmp);assert.ok(resolved.startsWith(root+path.sep));await rm(resolved,{recursive:true,force:true});});
