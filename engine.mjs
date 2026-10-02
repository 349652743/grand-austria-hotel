import {GUESTS,STAFF,STAFF_EFFECTS,OBJECTIVES,EMPERORS,ROOM_COLORS,ROOM_GROUPS,BLUE_BONUS,OTHER_BONUS,EMPEROR_POINTS,MARKET_COST} from './public/data.mjs';

const assert=(ok,message)=>{if(!ok) throw new Error(message);};
const sum=a=>a.reduce((s,n)=>s+n,0);
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const has=(p,id)=>p.staff.includes(id);
const effect=(type,n=1,extra={})=>({type,n,...extra});
function random(g) { let x=g.rng; x^=x<<13;x^=x>>>17;x^=x<<5;g.rng=x>>>0;return g.rng/4294967296; }
function shuffle(g,a) {a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(random(g)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const log=(g,text)=>{g.log.push({round:g.round,text});if(g.log.length>300)g.log.shift();};
function pay(p,n) {assert(integer(n,0,100),'费用无效');assert(p.money>=n,'克朗不足');p.money-=n;}
function money(p,n) {p.money=Math.min(20,p.money+n);}
function favor(p,n) {p.vp+=Math.max(0,p.emperor+n-13);p.emperor=Math.min(13,p.emperor+n);}
function bundle(g,p,effects,label) {if(effects.length)g.pending.unshift({owner:p.id,label,effects:structuredClone(effects)});}
function drawStaff(g,p,n) {for(let k=0;k<n&&g.staffDeck.length;k++)p.hand.push(g.staffDeck.shift());}
function refill(g) {while(g.market.length<5){if(!g.guestDeck.length){g.guestDeck=shuffle(g,g.guestDiscard);g.guestDiscard=[];}if(!g.guestDeck.length)break;g.market.unshift(g.guestDeck.shift());}}
function receiveGuest(g,p,index,free) {
 assert(integer(index,0,g.market.length-1),'请选择队列中的客人');assert(p.cafe.length<3,'咖啡厅的三张桌子已满');
 if(!free&&!has(p,25))pay(p,MARKET_COST[index]);
 const id=g.market.splice(index,1)[0];p.cafe.push({id,served:[0,0,0,0]});refill(g);log(g,`${p.name} 接待了${GUESTS[id].name}`);
}
const adjacent=(a,b)=>Math.abs(Math.floor(a/5)-Math.floor(b/5))+Math.abs(a%5-b%5)===1;
export function canPrepare(p,i) {return integer(i,0,19)&&p.rooms[i]===0&&(p.rooms.every(x=>!x)?i===0:p.rooms.some((v,j)=>v&&adjacent(i,j)));}
export function roomCost(p,i,discount=0) {return has(p,{blue:9,red:10,yellow:11}[ROOM_COLORS[i]])?0:Math.max(0,Math.floor(i/5)-discount);}
function prepare(p,i,discount=0,maxFloor=3) {
 assert(canPrepare(p,i),'只能从左下角开始，并与已准备或入住房间正交相邻');assert(Math.floor(i/5)<=maxFloor,'房间超出允许楼层');
 pay(p,roomCost(p,i,discount));p.rooms[i]=1;(p.roomGuests??=Array(20).fill(null))[i]=null;if(i>=17)p.vp+=i-15;
}
function occupy(p,i) {
 assert(integer(i,0,19)&&p.rooms[i]===1,'请选择一间已准备的空房');p.rooms[i]=2;
 // Missing legacy records and direct effect occupations have no known guest.
 (p.roomGuests??=Array(20).fill(null))[i]=null;
 const effects=[];if(has(p,23))effects.push(effect('money',1));
 const group=ROOM_GROUPS.findIndex(a=>a.includes(i));
 if(!p.bonuses.includes(group)&&ROOM_GROUPS[group].every(j=>p.rooms[j]===2)) {
  p.bonuses.push(group);const color=ROOM_COLORS[i],size=ROOM_GROUPS[group].length;
  effects.push(effect(color==='blue'?'points':color==='red'?'money':'favor',color==='blue'?BLUE_BONUS[size]:OTHER_BONUS[size]));
 }
 return effects;
}
function hireStaff(g,p,id,discount) {
 assert(p.hand.includes(id),'该员工不在你的手牌中');pay(p,Math.max(0,STAFF[id].cost-discount));p.hand.splice(p.hand.indexOf(id),1);p.staff.push(id);
 log(g,`${p.name} 雇佣了${STAFF[id].name}`);bundle(g,p,STAFF_EFFECTS[id]||[],STAFF[id].name);
}
export function counts(p) {
 const color=c=>p.rooms.filter((v,i)=>v===2&&ROOM_COLORS[i]===c).length;
 return {blue:color('blue'),red:color('red'),yellow:color('yellow'),occupied:p.rooms.filter(v=>v===2).length,prepared:p.rooms.filter(Boolean).length,
  rows:[0,1,2,3].filter(r=>p.rooms.slice(r*5,r*5+5).every(v=>v===2)).length,
  cols:[0,1,2,3,4].filter(c=>[0,1,2,3].every(r=>p.rooms[r*5+c]===2)).length,
  groups:ROOM_GROUPS.filter(a=>a.every(i=>p.rooms[i]===2)).length};
}
export function meets(p,obj) {
 const c=counts(p);return ({money:p.money===20,emperor:p.emperor>=10,staff:p.staff.length>=6,prepared:c.prepared>=12,rows:c.rows>=2,cols:c.cols>=2,groups:c.groups>=6,
  color:['blue','red','yellow'].some(color=>p.rooms.every((v,i)=>ROOM_COLORS[i]!==color||v===2)),rgb:Math.min(c.red,c.blue,c.yellow)>=3,ry:c.red>=4&&c.yellow>=3,yb:c.yellow>=4&&c.blue>=3,br:c.blue>=4&&c.red>=3})[obj.test];
}
function staffScore(g,p,id) {
 const c=counts(p);const values={27:c.red*3,28:c.blue*3,30:c.yellow*3,31:c.occupied,32:p.staff.length*2,34:c.prepared,37:c.groups*2,40:p.objectives.length*5,41:p.emperor*2,46:c.rows*5,47:c.cols*5,48:Math.min(c.red,c.blue,c.yellow)*4};
 if(id===29)return Math.max(0,...g.players.filter(q=>q.id!==p.id).flatMap(q=>q.staff.filter(s=>s!==29&&STAFF[s].kind==='end')).map(s=>staffScore(g,p,s)));
 return values[id]||0;
}
function finalScore(g) {
 g.phase='finished';g.turn=null;
 for(const p of g.players){const before=p.vp,staff=p.staff.reduce((s,id)=>s+staffScore(g,p,id),0),rooms=p.rooms.reduce((s,v,i)=>s+(v===2?Math.floor(i/5)+1:0),0),left=p.money+sum(p.kitchen),guests=-p.cafe.length*5;
  p.vp+=staff+rooms+left+guests;p.score={before,staff,rooms,left,guests,total:p.vp};}
 const ranked=[...g.players].sort((a,b)=>b.vp-a.vp||b.score.left-a.score.left);
 g.winners=ranked.filter(p=>p.vp===ranked[0].vp&&p.score.left===ranked[0].score.left).map(p=>p.id);log(g,`比赛结束：${g.winners.map(id=>g.players.find(p=>p.id===id).name).join('、')} 获胜`);
}
function roll(g,n) {g.dice=[0,0,0,0,0,0];for(let i=0;i<n;i++)g.dice[Math.floor(random(g)*6)]++;}
function startRound(g) {
 g.phase='playing';g.passed=[];g.slots=[];g.dustbin=0;
 const n=g.players.length,order=Array.from({length:n},(_,i)=>(g.start+i)%n);
 g.slots=[...order,...order.toReversed()].map((index,i)=>({player:g.players[index].id,number:i+1,done:false}));
 for(const p of g.players)p.used=[];
 roll(g,6+2*n);g.turn=null;log(g,`第 ${g.round} 轮开始`);advance(g);
}
function advance(g) {
 if(g.pending.length)return;
 if(g.phase==='setup')return;
 if(g.phase==='emperor') {if(g.round===7)return finalScore(g);g.round++;g.start=(g.start+1)%g.players.length;return startRound(g);}
 if(g.phase!=='playing'||g.turn)return;
 if(g.slots.every(s=>s.done)||sum(g.dice)===0)return endRound(g);
 let next=g.slots.find(s=>!s.done&&!g.passed.includes(s.player));
 if(!next){const n=sum(g.dice)-1;g.dustbin++;roll(g,n);g.passed=[];log(g,'暂缓的玩家重新行动：弃掉 1 颗骰子并重掷剩余骰子');if(!n)return endRound(g);next=g.slots.find(s=>!s.done);}
 g.turn={player:next.player,slot:next.number,touched:false,guest:false,main:false};
}
function endRound(g) {
 g.turn=null;
 if(![3,5,7].includes(g.round)){g.round++;g.start=(g.start+1)%g.players.length;return startRound(g);}
 g.phase='emperor';const tile=g.emperors[[3,5,7].indexOf(g.round)];log(g,`第 ${g.round} 轮皇帝结算 · ${tile.id}`);
 const order=Array.from({length:g.players.length},(_,i)=>g.players[(g.start+i)%g.players.length]);
 for(const p of order){p.vp+=EMPEROR_POINTS[p.emperor];p.emperor=Math.max(0,p.emperor-g.round);}
 // Build clockwise resolution order. Each frame may produce nested choices.
 for(const p of order){if(p.emperor>=3){const rewards=structuredClone(tile.bonus);if(has(p,42))rewards.push(effect('points',5));g.pending.push({owner:p.id,label:`皇帝 ${tile.id} 奖励`,effects:rewards});}
  else if(p.emperor===0)g.pending.push({owner:p.id,label:`皇帝 ${tile.id} 惩罚`,effects:[effect('penalty',1,{tile:tile.id,mandatory:true})]});}
 advance(g);
}
function applyPenalty(g,p,tile) {
 const free=p.rooms.map((v,i)=>v===1?i:-1).filter(i=>i>=0);
 if(tile==='A1'||tile==='B2'){const n=tile==='A1'?3:5;if(p.money>=n)pay(p,n);else p.vp-=n+2;}
 else if(tile==='A2'||tile==='B1'){p.kitchen=[0,0,0,0];if(tile==='B1')for(const c of p.cafe)c.served=[0,0,0,0];}
 else if(tile==='A3'||tile==='B3'){const n=tile==='A3'?2:3;if(p.hand.length<n)p.vp-=tile==='A3'?5:7;else bundle(g,p,[effect('discardHand',n,{mandatory:true})],'选择弃掉的员工手牌');}
 else if(tile==='A4'||tile==='B4'){const n=tile==='A4'?1:2;if(free.length<n)p.vp-=tile==='A4'?5:7;else bundle(g,p,Array.from({length:n},()=>effect('removeRoom',1,{status:1,mandatory:true})),'从最高楼层移除空房');}
 else if(tile==='C1')p.vp-=8;
 else if(tile==='C2'){const floors=[3,2,1,0].filter(r=>p.rooms.slice(r*5,r*5+5).some(v=>v===2)).slice(0,2);bundle(g,p,floors.map(floor=>effect('removeRoom',1,{status:2,floor,mandatory:true})),'移除最高的两个有住客楼层的房间');}
 else if(tile==='C3')p.vp-=2*p.staff.length;
 else if(tile==='C4'){if(p.staff.some(id=>STAFF[id].kind==='end'))bundle(g,p,[effect('discardStaff',1,{mandatory:true})],'选择弃掉的终局员工');else p.vp-=10;}
}
function mainEffects(g,p,face,target,power,physical) {
 const actual=face===6?target:face;assert(integer(actual,1,5),'请选择要模仿的行动');
 if(face===6)pay(p,physical&&has(p,17)?0:1);
 if(physical&&face===6&&has(p,17))power++;
 if(physical&&[1,2].includes(face)&&has(p,13))power++;
 if(physical&&face===5&&has(p,18))power+=2;
 if(actual===5)assert(p.hand.some(id=>Math.max(0,STAFF[id].cost-power)<=p.money),'无法执行员工主行动：没有可负担的员工手牌');
 const effects=[];
 if(actual<=2)effects.push(effect('dishes',power,{pair:actual===1?0:2}));
 if(actual===3)effects.push(effect('prepare',power,{discount:0,maxFloor:3}));
 if(actual===4)effects.push(effect('funds',power,{both:physical&&face===4&&has(p,15)}));
 if(actual===5)effects.push(effect('hire',1,{discount:power}));
 effects[0].mandatory=true;
 if(physical) {
  if([3,4].includes(face)&&has(p,12))effects.push(effect('points',2));
  if(face===4&&has(p,16))effects.push(effect('points',4));
  if(face===3&&has(p,19))effects.push(effect('points',5));
  if(face===5&&has(p,20))effects.push(effect('favor',2));
  if([1,2].includes(face)&&has(p,14))effects.push(effect('prepare',1,{discount:0,maxFloor:3}));
  if(face===3&&has(p,22))effects.push(effect('hire',1,{discount:0}));
 }
 return effects;
}
function allocate(p,items,allocations=[]) {
 assert(Array.isArray(allocations)&&allocations.length<=12,'餐饮分配无效');items=[...items];
 for(const a of allocations){assert(integer(a.food,0,3)&&integer(a.count,1,40),'餐饮数量无效');const c=p.cafe.find(c=>c.id===a.guest);assert(c,'客人不在咖啡厅');assert(items[a.food]>=a.count,'餐饮数量不足');assert(c.served[a.food]+a.count<=GUESTS[c.id].order[a.food],'超过客人的需求');items[a.food]-=a.count;c.served[a.food]+=a.count;}
 return items;
}
function resolve(g,p,a) {
 const frame=g.pending[0];assert(frame&&frame.owner===p.id,'请等待当前玩家选择');assert(integer(a.index,0,frame.effects.length-1),'奖励选项已经变化');const x=frame.effects[a.index];
 assert(x.mandatory||!frame.effects.some(e=>e.mandatory&&e.type!=='prepare'),'请先完成必须执行的主行动或惩罚');
 assert(!a.skip||!x.mandatory,'该行动必须执行');
 frame.effects.splice(a.index,1);if(!frame.effects.length)g.pending.shift();
 if(a.skip){if(x.type==='offer'&&x.cards){const order=a.rest||x.cards;assert(order.length===x.cards.length&&new Set(order).size===x.cards.length&&order.every(id=>x.cards.includes(id)),'请确认牌底顺序');g.staffDeck.push(...order);}return;}
 const again=(ex)=>bundle(g,p,[ex],frame.label);
 if(x.type==='money')money(p,x.n);
 else if(x.type==='favor')favor(p,x.n);
 else if(x.type==='points')p.vp+=x.n;
 else if(x.type==='staffPoints')p.vp+=x.n*p.staff.length;
 else if(x.type==='draw')drawStaff(g,p,x.n);
 else if(x.type==='food'||x.type==='anyFood'||x.type==='dishes') {
  let items=[0,0,0,0];
  if(x.type==='food')items[x.food]=x.n;
  if(x.type==='anyFood'){assert(Array.isArray(a.items)&&a.items.length===4&&a.items.every(v=>integer(v,0,x.n))&&sum(a.items)===x.n,'请选择指定数量的餐饮');items=a.items;}
  if(x.type==='dishes'){assert(integer(a.secondary,0,Math.floor(x.n/2)),'蛋糕不能多于苹果卷，咖啡不能多于红酒');items[x.pair]=x.n-a.secondary;items[x.pair+1]=a.secondary;}
  const left=allocate(p,items,a.allocations);p.kitchen=p.kitchen.map((n,i)=>n+left[i]);
 } else if(x.type==='funds') {assert(integer(a.favor,0,x.n),'分配数量无效');if(x.both){money(p,x.n);favor(p,x.n);}else{money(p,x.n-a.favor);favor(p,a.favor);}}
 else if(x.type==='prepare'||x.type==='prepareOccupy') {
  prepare(p,a.room,x.discount,x.maxFloor);if(x.n>1)again({...x,n:x.n-1,mandatory:false});
  if(x.type==='prepareOccupy')bundle(g,p,occupy(p,a.room),'入住奖励');
 } else if(x.type==='occupy'){bundle(g,p,occupy(p,a.room),'房间组奖励');}
 else if(x.type==='hire'){hireStaff(g,p,a.staff,x.discount);}
 else if(x.type==='guest'){receiveGuest(g,p,a.guest,true);}
 else if(x.type==='offer') {
  if(!x.cards){const cards=g.staffDeck.splice(0,3);if(cards.length)again({...x,cards});}
  else {assert(x.cards.includes(a.staff),'请选择抽到的员工');const rest=x.cards.filter(id=>id!==a.staff);assert(Array.isArray(a.rest)&&a.rest.length===rest.length&&new Set(a.rest).size===rest.length&&a.rest.every(id=>rest.includes(id)),'请确认其余员工的牌底顺序');g.staffDeck.push(...a.rest);p.hand.push(a.staff);hireStaff(g,p,a.staff,x.discount);}
 } else if(x.type==='complete') {const c=p.cafe.find(c=>c.id===a.guest);assert(c,'请选择咖啡厅中的客人');c.served=[...GUESTS[c.id].order];}
 else if(x.type==='bonusDie'){assert(integer(a.face,1,6)&&g.dice[a.face-1]>0,'该行动没有骰子');bundle(g,p,mainEffects(g,p,a.face,a.target,g.dice[a.face-1],false),'吉萨的额外行动');}
 else if(x.type==='penalty'){if(a.protect){assert(has(p,26),'没有会议经理');pay(p,1);}else applyPenalty(g,p,x.tile);}
 else if(x.type==='discardHand'){assert(Array.isArray(a.cards)&&a.cards.length===x.n&&new Set(a.cards).size===x.n&&a.cards.every(id=>p.hand.includes(id)),'请选择足够数量且不重复的员工手牌');p.hand=p.hand.filter(id=>!a.cards.includes(id));g.staffDeck.push(...a.cards);}
 else if(x.type==='discardStaff'){assert(p.staff.includes(a.staff)&&STAFF[a.staff].kind==='end','请选择已雇佣的终局员工');p.staff.splice(p.staff.indexOf(a.staff),1);g.staffDiscard.push(a.staff);}
 else if(x.type==='removeRoom') {assert(integer(a.room,0,19)&&p.rooms[a.room]===x.status,'请选择符合条件的房间');const floor=x.floor??Math.max(...p.rooms.map((v,i)=>v===x.status?Math.floor(i/5):-1));assert(Math.floor(a.room/5)===floor,'必须选择指定的最高楼层');p.rooms[a.room]=0;(p.roomGuests??=Array(20).fill(null))[a.room]=null;}
 else throw new Error('未知效果');
}
// A mandatory preparation needs one room, not every point of die strength.
// Staff Manager may act before it. Only waivers (9/10/11) and Page Boy (35)
// can rescue affordability: at most one hire, two occupations and their income.
// This is a finite feasibility check, not a turn planner. Use resolve on copies
// so nested frames, group bonuses, Custodian income and the money cap stay exact.
function assertPreparationCompletable(g) {
 if(!g.pending.some(f=>f.effects.some(x=>x.type==='prepare'&&x.mandatory)))return;
 const seen=new Set();
 function possible(state) {
  const frame=state.pending[0],p=state.players.find(p=>p.id===frame.owner);
  const required=frame.effects.find(x=>x.type==='prepare'&&x.mandatory);
  if(required&&p.rooms.some((_,i)=>canPrepare(p,i)&&Math.floor(i/5)<=required.maxFloor&&roomCost(p,i,required.discount)<=p.money))return true;
  const key=JSON.stringify([p.money,p.rooms,p.staff,p.hand,p.bonuses,state.pending]);
  if(seen.has(key))return false;seen.add(key);
  const attempt=a=>{const next=structuredClone(state);resolve(next,next.players.find(q=>q.id===p.id),a);return possible(next);};
  // Other optional rewards neither fund preparation nor create empty positions.
  const irrelevant=frame.effects.findIndex(x=>!x.mandatory&&!['hire','occupy','money'].includes(x.type));
  if(irrelevant>=0)return attempt({index:irrelevant,skip:true});
  for(let index=0;index<frame.effects.length;index++) {
   const x=frame.effects[index];if(x.mandatory)continue;
   if(attempt({index,skip:true}))return true;
   if(x.type==='money'&&attempt({index}))return true;
   if(x.type==='hire')for(const staff of p.hand.filter(id=>[9,10,11,35].includes(id)&&Math.max(0,STAFF[id].cost-x.discount)<=p.money))if(attempt({index,staff}))return true;
   if(x.type==='occupy')for(let room=0;room<20;room++)if(p.rooms[room]===1&&attempt({index,room}))return true;
  }
  return false;
 }
 assert(possible(g),'无法执行房间主行动：没有可完成的合法准备路径');
}
export function createGame(seats,seed=Date.now()) {
 assert(Array.isArray(seats)&&seats.length>=2&&seats.length<=4,'需要 2–4 名玩家');
 const g={version:1,rng:(seed>>>0)||1,round:1,phase:'setup',start:0,setupIndex:0,pending:[],log:[],guestDiscard:[],staffDiscard:[],dice:[0,0,0,0,0,0],dustbin:0,slots:[],passed:[],turn:null};
 g.start=Math.floor(random(g)*seats.length);
 g.guestDeck=shuffle(g,Object.keys(GUESTS).map(Number));g.staffDeck=shuffle(g,Object.keys(STAFF).map(Number));
 g.market=[];refill(g);
 g.objectives=['A','B','C'].map(group=>({...shuffle(g,OBJECTIVES.filter(o=>o.group===group))[0],claimed:[]}));
 g.emperors=['A','B','C'].map(letter=>structuredClone(shuffle(g,EMPERORS.filter(e=>e.id[0]===letter))[0]));
 g.players=seats.map(({id,name})=>({id,name,money:10,emperor:0,vp:0,kitchen:[1,1,1,1],rooms:Array(20).fill(0),roomGuests:Array(20).fill(null),hand:[],staff:[],used:[],cafe:[],bonuses:[],objectives:[]}));
 for(const p of g.players)drawStaff(g,p,6);
 g.setupOrder=Array.from({length:seats.length},(_,i)=>g.players[(g.start+seats.length-1-i)%seats.length].id);log(g,'酒店开业筹备：逆时针选择首位客人，再准备三间房');return g;
}
// Every command works on a copy. Rejected or partially invalid actions never mutate the game.
export function act(previous,playerId,a) {
 assert(a&&typeof a.type==='string','行动格式无效');const g=structuredClone(previous),p=g.players.find(p=>p.id===playerId);assert(p,'玩家不存在');assert(g.phase!=='finished','本局已经结束');
 if(g.pending.length){assert(a.type==='resolve','请先处理待结算的奖励或惩罚');resolve(g,p,a);assertPreparationCompletable(g);advance(g);return g;}
 if(g.phase==='setup') {
  assert(g.setupOrder[g.setupIndex]===playerId,'还没轮到你准备酒店');assert(a.type==='setup','请完成开局准备');
  assert(Array.isArray(a.rooms)&&a.rooms.length===3,'请选择三间初始客房');receiveGuest(g,p,a.guest,true);for(const i of a.rooms)prepare(p,i);
  g.setupIndex++;if(g.setupIndex===g.players.length)startRound(g);return g;
 }
 assert(g.phase==='playing'&&g.turn?.player===playerId,'还没轮到你行动');
 const turn=g.turn;
 if(a.type==='pass'){assert(!turn.touched,'已经开始行动，不能暂缓');g.passed.push(p.id);g.turn=null;log(g,`${p.name} 暂缓行动`);advance(g);return g;}
 if(a.type==='guest'){assert(!turn.guest&&!turn.main,'每回合只能在主行动前接待一位客人');receiveGuest(g,p,a.guest,false);turn.guest=true;}
 else if(a.type==='die') {
  assert(!turn.main,'本回合已执行过主行动');assert(integer(a.face,1,6)&&g.dice[a.face-1]>0,'该骰子行动不可用');
  if(a.boost)pay(p,1);
  const effects=mainEffects(g,p,a.face,a.target,g.dice[a.face-1]+(a.boost?1:0),true);
  g.dice[a.face-1]--;turn.main=true;bundle(g,p,effects,'骰子主行动');log(g,`${p.name} 选择骰子 ${a.face}${a.boost?'（增强）':''}`);
 } else if(a.type==='serve') {
  assert(Array.isArray(a.allocations)&&a.allocations.length>0,'请选择送餐对象');const n=a.allocations.reduce((s,v)=>s+v.count,0);assert(integer(n,1,3),'一次最多送 3 份餐饮');if(!has(p,24))pay(p,1);p.kitchen=allocate(p,p.kitchen,a.allocations);
 } else if(a.type==='checkin') {
  const c=p.cafe.find(c=>c.id===a.guest);assert(c,'该客人不在咖啡厅');const card=GUESTS[c.id];assert(c.served.every((n,i)=>n===card.order[i]),'请先满足客人的全部餐饮需求');
  assert(integer(a.room,0,19)&&(card.color==='green'||ROOM_COLORS[a.room]===card.color),'房间颜色不符合客人的要求');
  const effects=occupy(p,a.room);(p.roomGuests??=Array(20).fill(null))[a.room]=card.id;p.vp+=card.vp;p.cafe.splice(p.cafe.indexOf(c),1);g.guestDiscard.push(card.id);
  if(card.color==='red'&&has(p,5))effects.push(effect('money',2));if(card.color==='blue'&&has(p,6))effects.push(effect('favor',1));
  if(card.color==='yellow'&&has(p,7))effects.push(effect('money',1));if(card.color==='green'&&has(p,8))effects.push(effect('points',2));
  if(sum(card.order)>=4&&has(p,33))effects.push(effect('points',4));
  // Gizia acts only after all other check-in benefits, including nested effects.
  bundle(g,p,card.rewards.filter(x=>x.type==='bonusDie'),'吉萨的额外行动');
  bundle(g,p,[...card.rewards.filter(x=>x.type!=='bonusDie'),...effects],`${card.name} 入住奖励`);log(g,`${p.name} 安排${card.name}入住 ${Math.floor(a.room/5)+1}0${a.room%5+1} · +${card.vp} 分`);
 } else if(a.type==='staff') {
  assert(p.staff.includes(a.staff)&&STAFF[a.staff].kind==='round','该员工不能主动使用');assert(!p.used.includes(a.staff),'该员工本轮已使用');p.used.push(a.staff);bundle(g,p,[effect('food',1,{food:a.staff-1})],STAFF[a.staff].name);
 } else if(a.type==='claim') {
  const obj=g.objectives.find(o=>o.id===a.objective);assert(obj&&!obj.claimed.includes(p.id),'该目标不存在或已领取');assert(obj.claimed.length<3,'该目标的三个奖励席位已满');assert(meets(p,obj),'尚未满足目标条件');const vp=[15,10,5][obj.claimed.length];p.vp+=vp;p.objectives.push(obj.id);obj.claimed.push(p.id);log(g,`${p.name} 达成「${obj.text}」· +${vp} 分`);
 } else if(a.type==='end') {
  assert(turn.main,'必须执行一次骰子主行动才能结束回合');g.slots.find(s=>s.number===turn.slot).done=true;g.turn=null;advance(g);return g;
 } else throw new Error('未知行动');
 turn.touched=true;assertPreparationCompletable(g);advance(g);return g;
}
// No shuffled decks, opponent hands, PRNG state or private offers cross this boundary.
export function view(g,playerId) {
 if(!g)return null;const out=structuredClone(g);delete out.rng;out.guestDeckCount=g.guestDeck.length;out.staffDeckCount=g.staffDeck.length;delete out.guestDeck;delete out.staffDeck;delete out.staffDiscard;
 for(const p of out.players){p.handCount=p.hand.length;if(p.id!==playerId)delete p.hand;}
 for(const frame of out.pending)if(frame.owner!==playerId)for(const x of frame.effects)delete x.cards;
 return out;
}
