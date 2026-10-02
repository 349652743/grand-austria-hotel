import {act,canPrepare,roomCost,meets} from '../engine.mjs';
import {GUESTS,STAFF,ROOM_COLORS} from '../public/data.mjs';
export const actor=g=>g.pending[0]?.owner||(g.phase==='setup'?g.setupOrder[g.setupIndex]:g.turn?.player);
// Offline test driver only: probe the copy-on-write engine, never a server.
const legalDice=g=>[1,2,3,4,5,6].filter(face=>{try{act(g,g.turn.player,{type:'die',face,target:4});return true;}catch{return false;}});
export function allocateToGuests(p,items,limit=100){const allocations=[];items=[...items];for(const c of p.cafe)for(let food=0;food<4;food++){const count=Math.min(items[food],GUESTS[c.id].order[food]-c.served[food],limit);if(count>0){allocations.push({guest:c.id,food,count});items[food]-=count;limit-=count;}}return allocations;}
export function decide(g){const owner=actor(g),p=g.players.find(p=>p.id===owner);if(!p)return null;
 if(g.pending.length){const x=g.pending[0].effects[0],a={type:'resolve',index:0};
  const skip=()=>({...a,skip:true});
  if(x.type==='dishes'){a.secondary=Math.floor(x.n/2);const items=[0,0,0,0];items[x.pair]=x.n-a.secondary;items[x.pair+1]=a.secondary;a.allocations=allocateToGuests(p,items);}
  else if(x.type==='food'){const items=[0,0,0,0];items[x.food]=x.n;a.allocations=allocateToGuests(p,items);}
  else if(x.type==='anyFood'){a.items=[0,0,0,0];for(let k=0;k<x.n;k++){const needs=[0,1,2,3].map(i=>p.cafe.reduce((s,c)=>s+GUESTS[c.id].order[i]-c.served[i],0)-a.items[i]);let i=needs.indexOf(Math.max(...needs));a.items[i]++;}a.allocations=allocateToGuests(p,a.items);}
  else if(x.type==='funds')a.favor=p.money<5?Math.floor(x.n/2):Math.min(x.n,Math.max(0,13-p.emperor));
  else if(x.type==='prepare'||x.type==='prepareOccupy'){const choices=p.rooms.map((_,i)=>i).filter(i=>canPrepare(p,i)&&Math.floor(i/5)<=x.maxFloor&&roomCost(p,i,x.discount)<=p.money);choices.sort((a,b)=>roomCost(p,a,x.discount)-roomCost(p,b,x.discount));if(!choices.length)return skip();a.room=choices[0];}
  else if(x.type==='occupy'){a.room=p.rooms.indexOf(1);if(a.room<0)return skip();}
  else if(x.type==='hire'){a.staff=p.hand.find(id=>STAFF[id].cost-x.discount<=p.money);if(!a.staff)return skip();}
  else if(x.type==='offer'&&x.cards){a.staff=x.cards.find(id=>STAFF[id].cost-x.discount<=p.money);if(!a.staff)return skip();a.rest=x.cards.filter(id=>id!==a.staff);}
  else if(x.type==='guest'){if(p.cafe.length>=3)return skip();a.guest=g.market.length-1;}
  else if(x.type==='complete'){if(!p.cafe.length)return skip();a.guest=p.cafe[0].id;}
  else if(x.type==='bonusDie'){a.face=[1,2,3,4,5,6].find(face=>{try{act(g,owner,{...a,face,target:4});return true;}catch{return false;}});if(!a.face)return skip();a.target=4;}
  else if(x.type==='penalty')a.protect=p.staff.includes(26)&&p.money>=1;
  else if(x.type==='discardHand')a.cards=p.hand.slice(0,x.n);
  else if(x.type==='discardStaff')a.staff=p.staff.find(id=>STAFF[id].kind==='end');
  else if(x.type==='removeRoom'){const floor=x.floor??Math.max(...p.rooms.map((v,i)=>v===x.status?Math.floor(i/5):-1));a.room=p.rooms.findIndex((v,i)=>v===x.status&&Math.floor(i/5)===floor);}
  return a;
 }
 if(g.phase==='setup')return {type:'setup',guest:4,rooms:[0,1,2]};
 const legal=g.turn.main?[]:legalDice(g);
 if(!g.turn.main&&!legal.length&&!g.turn.touched)return {type:'pass'};
 for(const c of p.cafe){if(c.served.every((n,i)=>n===GUESTS[c.id].order[i])){const room=p.rooms.findIndex((s,i)=>s===1&&(GUESTS[c.id].color==='green'||ROOM_COLORS[i]===GUESTS[c.id].color));if(room>=0)return {type:'checkin',guest:c.id,room};}}
 const objective=g.objectives.find(o=>!o.claimed.includes(p.id)&&o.claimed.length<3&&meets(p,o));if(objective)return {type:'claim',objective:objective.id};
 const staff=p.staff.find(id=>STAFF[id].kind==='round'&&!p.used.includes(id));if(staff)return {type:'staff',staff};
 const allocations=allocateToGuests(p,p.kitchen,3);if(allocations.length&&(p.money>2||p.staff.includes(24))){const action={type:'serve',allocations};if(g.turn.main||legalDice(act(g,owner,action)).length)return action;}
 if(g.turn.main)return {type:'end'};
 if(!g.turn.guest&&p.cafe.length<2)return {type:'guest',guest:4};
 const needs=[0,1,2,3].map(i=>p.cafe.reduce((s,c)=>s+GUESTS[c.id].order[i]-c.served[i],0));
 const weights=[needs[0]+needs[1],needs[2]+needs[3],p.rooms.filter(v=>v===1).length<2?5:0,p.emperor<g.round+3?6:1,p.hand.length&&p.money>2?3:0,0];
 let face=g.dice.map((n,i)=>({n,i,weight:weights[i]})).filter(x=>legal.includes(x.i+1)&&x.i<5).sort((a,b)=>b.weight-a.weight)[0]?.i;
 if(face===undefined){if(p.money>0||p.staff.includes(17))return {type:'die',face:6,target:4};if(!g.turn.touched)return {type:'pass'};throw new Error('bot cannot afford any action after committing');}
 return {type:'die',face:face+1,target:4,boost:false};
}
export function finishGame(game,max=5000){let g=game;const history=[];for(let i=0;i<max&&g.phase!=='finished';i++){const who=actor(g),action=decide(g);history.push({who,action});try{g=act(g,who,action);}catch(e){e.message+=`\nphase=${g.phase} round=${g.round} player=${who} action=${JSON.stringify(action)} pending=${JSON.stringify(g.pending[0])}`;throw e;}}if(g.phase!=='finished')throw new Error('Game did not terminate');return {game:g,history};}
