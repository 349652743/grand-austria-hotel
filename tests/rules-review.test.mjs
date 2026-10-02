import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act} from '../engine.mjs';
import {STAFF,STAFF_EFFECTS} from '../public/data.mjs';

function ready(){let g=createGame([{id:'p',name:'P'},{id:'q',name:'Q'}],9876);while(g.phase==='setup')g=act(g,g.setupOrder[g.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});return g;}
const player=g=>g.players.find(p=>p.id===g.turn.player);
const resolve=(g,a={})=>act(g,g.pending[0].owner,{type:'resolve',index:0,...a});

// Compatibility checks: these behaviors must remain legal, not newly implemented.
test('all immediate staff rewards remain optional after a mandatory hire',()=>{
 for(const card of Object.values(STAFF).filter(c=>STAFF_EFFECTS[c.id]?.length)){
  let g=ready();player(g).hand=[card.id];player(g).money=20;g.dice=[0,0,0,0,1,0];
  g=act(g,g.turn.player,{type:'die',face:5});g=resolve(g,{staff:card.id});
  assert.ok(player(g).staff.includes(card.id));assert.ok(g.pending.length);
  while(g.pending.length){assert.ok(!g.pending[0].effects[0].mandatory,card.name);g=resolve(g,{skip:true});}
 }
});
test('zero net money gain at the cap is legal when the funds main action is actually resolved',()=>{
 let g=ready();player(g).money=20;g.dice=[0,0,0,2,0,0];
 g=act(g,g.turn.player,{type:'die',face:4});g=resolve(g,{favor:0});
 assert.equal(player(g).money,20);assert.doesNotThrow(()=>act(g,g.turn.player,{type:'end'}));
});
test('preflight honors room waivers and the physical staff discount',()=>{
 let g=ready();Object.assign(player(g),{money:0,staff:[11],rooms:[1,1,1,1,1,...Array(15).fill(0)]});g.dice=[0,0,1,0,0,0];
 g=act(g,g.turn.player,{type:'die',face:3});g=resolve(g,{room:5});assert.equal(player(g).money,0);
 g=ready();Object.assign(player(g),{money:0,staff:[18],hand:[12]});g.dice=[0,0,0,0,1,0];
 g=act(g,g.turn.player,{type:'die',face:5});g=resolve(g,{staff:12});assert.ok(player(g).staff.includes(12));
});
test('Gizia may be declined after other benefits and cannot choose an impossible room action',()=>{
 let g=ready();const id=g.turn.player;Object.assign(player(g),{rooms:Array(20).fill(1),cafe:[{id:97,served:[2,0,1,0]}]});g.dice=[0,0,1,0,0,0];
 g=act(g,id,{type:'checkin',guest:97,room:0});g=resolve(g);
 const before=structuredClone(g);assert.throws(()=>resolve(g,{face:3}),/无法执行/);assert.deepEqual(g,before);
 g=resolve(g,{skip:true});assert.equal(g.pending.length,0);assert.equal(g.turn.main,false);
});

// Official p.14 #22 permits either order, but the required room must remain completable.
test('CORE-001: a triggered hire cannot spend the money needed by the mandatory room action',()=>{
 let g=ready();Object.assign(player(g),{staff:[22],hand:[6],money:1,rooms:[1,1,1,1,1,...Array(15).fill(0)]});
 g.dice=[0,0,1,0,0,0];g=act(g,g.turn.player,{type:'die',face:3});
 assert.throws(()=>resolve(g,{index:1,staff:6}),/主行动/);
 g=resolve(g,{room:5});g=resolve(g,{skip:true});assert.equal(g.pending.length,0);
});

// Official p.18 #97: collect all other benefits before Gizia's action.
test('CARDS-GIZIA-ORDER-001: Custodian and group rewards resolve before the extra action',()=>{
 let g=ready();const id=g.turn.player;Object.assign(player(g),{money:20,staff:[23],cafe:[{id:97,served:[2,0,1,0]}]});
 g.dice=[0,0,0,0,0,1];g=act(g,id,{type:'checkin',guest:97,room:0});
 assert.ok(!g.pending[0].effects.some(x=>x.type==='bonusDie'),'extra action must not be selectable yet');
 assert.deepEqual(g.pending[0].effects.map(x=>x.type),['money','points']);
 assert.throws(()=>act(g,id,{type:'die',face:6,target:4}),/先处理/);
 g=resolve(g);g=resolve(g);assert.equal(player(g).money,20);assert.equal(player(g).vp,6);
 assert.equal(g.pending[0].effects[0].type,'bonusDie');
 g=resolve(g,{face:6,target:4});g=resolve(g,{favor:1});
 assert.equal(player(g).money,19);assert.deepEqual(g.dice,[0,0,0,0,0,1]);assert.equal(g.pending.length,0);
});

// Official rules pp.7–8: cannot pay for a room / exactly one staff card.
test('CORE-001: impossible rooms and hires are rejected atomically before taking a die',()=>{
 for(const fixture of [
  {face:3,rooms:Array(20).fill(1),money:20},
  {face:3,rooms:[1,1,1,1,1,...Array(15).fill(0)],money:0},
  {face:5,hand:[],money:20},
  {face:5,hand:[17],money:0},
  {face:6,target:3,rooms:[1,1,1,1,1,...Array(15).fill(0)],money:1},
  {face:3,boost:true,rooms:[1,1,1,1,1,...Array(15).fill(0)],money:1}
 ]){const g=ready();Object.assign(player(g),fixture);g.dice=[1,1,1,1,1,1];const before=structuredClone(g);
  assert.throws(()=>act(g,g.turn.player,{type:'die',face:fixture.face,target:fixture.target,boost:fixture.boost}),/无法执行/);
  assert.deepEqual(g,before);
 }
});

// Official rules pp.6–8: mandatory main action; rooms: one or more.
test('CORE-001: each physical main action cannot be skipped in full',()=>{
 for(const face of [1,2,3,4,5,6]){
  let g=ready();player(g).hand=[1];g.dice=[2,2,2,2,2,2];
  g=act(g,g.turn.player,{type:'die',face,target:3});
  const before=structuredClone(g);
  assert.equal(g.pending[0].effects[0].mandatory,true,`face ${face} exposes mandatory to UI`);
  assert.throws(()=>resolve(g,{skip:true}),/必须执行/,`face ${face}`);
  assert.deepEqual(g,before);
 }
});

test('CORE-001: after one prepared room unused strength may be skipped even with no legal room left',()=>{
 let g=ready();player(g).rooms=Array(20).fill(1);player(g).rooms[19]=0;g.dice=[0,0,3,0,0,0];
 g=act(g,g.turn.player,{type:'die',face:3});g=resolve(g,{room:19});
 assert.ok(!g.pending[0].effects[0].mandatory);
 g=resolve(g,{skip:true});assert.equal(g.pending.length,0);
 assert.equal(player(g).rooms[19],1);assert.doesNotThrow(()=>act(g,g.turn.player,{type:'end'}));
});
