import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act} from '../engine.mjs';
import {STAFF} from '../public/data.mjs';

function ready(overrides){let g=createGame([{id:'p',name:'P'},{id:'q',name:'Q'}],9876);while(g.phase==='setup')g=act(g,g.setupOrder[g.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});Object.assign(player(g),overrides);g.dice=[0,0,1,0,0,0];return g;}
const player=g=>g.players.find(p=>p.id===g.turn.player);
const take=g=>act(g,g.turn.player,{type:'die',face:3});
const resolve=(g,a={})=>act(g,g.pending[0].owner,{type:'resolve',index:0,...a});
const firstFloor=[1,1,1,1,1,...Array(15).fill(0)];
function pageBoy(staff=[22]){const rooms=[...Array(15).fill(1),...Array(5).fill(0)];for(const i of [2,3,7])rooms[i]=2;return ready({staff,hand:[35],money:2,rooms});}

// Official p.14 #22: "before or after taking the main action".
test('FINAL-RULES-001: hire Florist before preparing, applying its waiver',()=>{
 let g=take(ready({staff:[22],hand:[11],money:10,rooms:firstFloor}));
 g=resolve(g,{index:1,staff:11});g=resolve(g,{room:5});
 assert.equal(player(g).money,5);assert.equal(player(g).rooms[5],1);assert.deepEqual(player(g).staff,[22,11]);assert.equal(g.pending.length,0);
});
// Official pp.14–15 #22/#35: Page Boy's immediate occupations fund preparation.
test('FINAL-RULES-002: nested red-group income makes initially unaffordable preparation legal',()=>{
 let g=take(pageBoy());g=resolve(g,{index:1,staff:35});g=resolve(g,{room:8});g=resolve(g);g=resolve(g,{skip:true});g=resolve(g,{room:15});
 assert.equal(player(g).money,7);assert.equal(player(g).rooms[15],1);assert.equal(g.pending.length,0);
});
test('spending the last room money on an unrelated hire is rejected atomically',()=>{
 const g=take(ready({staff:[22],hand:[6],money:1,rooms:firstFloor})),before=structuredClone(g);
 assert.throws(()=>resolve(g,{index:1,staff:6}),/主行动/);assert.deepEqual(g,before);
});
function rejectsUnchanged(g,a){const before=structuredClone(g);assert.throws(()=>resolve(g,a),/主行动|必须执行/);assert.deepEqual(g,before);}
test('each intermediate step preserves a completion path: hire, occupations and money cannot all be declined',()=>{
 let g=take(pageBoy());rejectsUnchanged(g,{index:1,skip:true});rejectsUnchanged(g,{skip:true});
 g=resolve(g,{index:1,staff:35});
 // Declining the first occupation remains legal, as the second can finish red.
 g=resolve(g,{skip:true});rejectsUnchanged(g,{skip:true});rejectsUnchanged(g,{room:0});
 g=resolve(g,{room:8});rejectsUnchanged(g,{skip:true});
 g=resolve(g);g=resolve(g,{room:15});assert.equal(player(g).money,7);
});
test('two nested Custodian incomes can fund a room; dropping either occupation or income cannot',()=>{
 let g=take(ready({staff:[22,23],hand:[35],money:2,rooms:[...Array(10).fill(1),...Array(10).fill(0)]}));
 g=resolve(g,{index:1,staff:35});rejectsUnchanged(g,{skip:true});
 g=resolve(g,{room:1});rejectsUnchanged(g,{skip:true});g=resolve(g);
 rejectsUnchanged(g,{skip:true});g=resolve(g,{room:2});rejectsUnchanged(g,{skip:true});g=resolve(g);
 g=resolve(g,{room:10});assert.equal(player(g).money,0);assert.equal(g.pending.length,0);
});
test('a red group requiring both Page Boy occupations rejects a wrong first room',()=>{
 let base=pageBoy();player(base).rooms[7]=1;let g=take(base);g=resolve(g,{index:1,staff:35});
 rejectsUnchanged(g,{room:0});rejectsUnchanged(g,{skip:true});
 g=resolve(g,{room:7});g=resolve(g,{room:8});g=resolve(g);g=resolve(g,{room:15});
 assert.equal(player(g).money,7);assert.equal(g.pending.length,0);
});
test('unrelated hire before preparation and Florist after preparation remain legal',()=>{
 let g=take(ready({staff:[22],hand:[6],money:2,rooms:firstFloor}));g=resolve(g,{index:1,staff:6});g=resolve(g,{room:5});assert.equal(player(g).money,0);
 g=take(ready({staff:[22],hand:[11],money:10,rooms:firstFloor}));g=resolve(g,{room:5});g=resolve(g,{staff:11});assert.equal(player(g).money,4);
});
test('all three room waivers may rescue zero remaining money after hiring',()=>{
 for(const [staff,room] of [[9,10],[10,11],[11,5]]){
  let g=take(ready({staff:[22],hand:[staff],money:STAFF[staff].cost,rooms:Array.from({length:20},(_,i)=>i<room?1:0)}));
  g=resolve(g,{index:1,staff});g=resolve(g,{room});assert.equal(player(g).money,0);assert.equal(g.pending.length,0);
 }
});
test('Page Boy cannot create a preparation position in a full hotel',()=>{
 const g=ready({staff:[22],hand:[35],money:2,rooms:Array(20).fill(1)}),before=structuredClone(g);
 assert.throws(()=>take(g),/无法执行/);assert.deepEqual(g,before);
});
