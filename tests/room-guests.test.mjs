import test from 'node:test';

test('room reuse clears historical records on removal, preparation and effect occupation',()=>{
 const {g,p,card}=fixture();p.roomGuests[0]=card.id;p.rooms[0]=2;
 const removed=resolve(g,'removeRoom',0,{status:2});
 assert.equal(removed.players[0].rooms[0],0);
 assert.equal(removed.players[0].roomGuests[0],null);
 const prepared=resolve(removed,'prepare',0,{discount:0,maxFloor:3});
 assert.equal(prepared.players[0].roomGuests[0],null);
 prepared.players[0].roomGuests[0]=card.id;
 const occupied=resolve(prepared,'occupy',0);
 assert.equal(occupied.players[0].rooms[0],2);
 assert.equal(occupied.players[0].roomGuests[0],null);
 const stale=structuredClone(removed);stale.players[0].roomGuests[0]=card.id;
 assert.equal(resolve(stale,'prepare',0,{discount:0,maxFloor:3}).players[0].roomGuests[0],null);
 assert.equal(resolve(stale,'prepareOccupy',0,{discount:0,maxFloor:3}).players[0].roomGuests[0],null);
});

test('legacy occupied rooms stay unknown and only subsequent operations record guests',()=>{
 const {g,p,card}=fixture();delete p.roomGuests;p.rooms[1]=2;
 const saved=JSON.stringify(g);
 assert.equal(view(g,'b').players[0].roomGuests,undefined);
 const next=checkin(g,card);
 assert.equal(next.players[0].roomGuests.length,20);
 assert.equal(next.players[0].roomGuests[0],card.id);
 assert.equal(next.players[0].roomGuests[1],null);
 assert.equal(JSON.stringify(g),saved);
 assert.equal(resolve(g,'occupy',0).players[0].roomGuests[0],null);
 assert.equal(resolve(g,'removeRoom',1,{status:2}).players[0].roomGuests[1],null);
});

test('failed check-ins never change records or initialize a legacy original',()=>{
 for(const legacy of [false,true])for(const failure of ['food','room','color']) {
  const {g,p,card}=fixture();if(legacy)delete p.roomGuests;
  let guest=card;
  if(failure==='food')p.cafe[0].served=card.order.map(n=>n+1);
  if(failure==='room')p.rooms[0]=2;
  if(failure==='color') {guest=Object.values(GUESTS).find(c=>c.color!=='green'&&c.color!==ROOM_COLORS[0]);p.cafe=[{id:guest.id,served:[...guest.order]}];}
  const before=structuredClone(g);
  assert.throws(()=>checkin(g,guest));assert.deepEqual(g,before);
 }
});

test('serialized snapshots restore records and recycled guests may be recorded again',()=>{
 const {g,card}=fixture(),before=JSON.parse(JSON.stringify(g));
 let next=checkin(g,card);const after=JSON.parse(JSON.stringify(next));
 assert.equal(before.players[0].roomGuests[0],null);
 assert.equal(after.players[0].roomGuests[0],card.id);
 next.pending=[];next.players[0].rooms[1]=1;
 next.players[0].cafe=[{id:card.id,served:[...card.order]}];
 next=checkin(next,card,1);
 assert.deepEqual(next.players[0].roomGuests.slice(0,2),[card.id,card.id]);
 assert.deepEqual(after.players[0].roomGuests.slice(0,2),[card.id,null]);
});

import assert from 'node:assert/strict';
import {createGame,act,view} from '../engine.mjs';
import {GUESTS,ROOM_COLORS} from '../public/data.mjs';

function fixture() {
 const g=createGame([{id:'a',name:'A'},{id:'b',name:'B'}],17);
 g.phase='playing';g.turn={player:'a',slot:1,touched:false,guest:false,main:false};
 const p=g.players[0],card=Object.values(GUESTS).find(c=>c.color==='green');
 p.rooms[0]=1;p.cafe=[{id:card.id,served:[...card.order]}];
 return {g,p,card};
}
const checkin=(g,card,room=0)=>act(g,'a',{type:'checkin',guest:card.id,room});
const resolve=(g,type,room,extra={})=>{
 g=structuredClone(g);g.pending=[{owner:'a',label:'test',effects:[{type,n:1,...extra}]}];
 return act(g,'a',{type:'resolve',index:0,room});
};

test('new games initialize independent room records and check-in publishes only the guest ID',()=>{
 const {g,p,card}=fixture();
 assert.deepEqual(p.roomGuests,Array(20).fill(null));
 assert.notEqual(p.roomGuests,g.players[1].roomGuests);
 const before=structuredClone(g),next=checkin(g,card);
 assert.equal(next.players[0].rooms[0],2);
 assert.equal(next.players[0].roomGuests[0],card.id);
 assert.deepEqual(g,before);
 assert.equal(next.guestDiscard.at(-1),card.id);
 assert.equal(next.players[0].cafe.length,0);
 assert.equal(next.players[0].vp,p.vp+card.vp);
 const publicView=view(next,'b');
 assert.equal(publicView.players[0].roomGuests[0],card.id);
 assert.equal(publicView.players[0].hand,undefined);
 assert.equal(publicView.guestDeck,undefined);
});
