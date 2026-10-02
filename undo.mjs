// Server-only, single game snapshot: never attach this to game or its public view.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function barrier(before,after,player){
 if(before?.phase!=='playing'||after?.phase!=='playing'||!before.turn||!after.turn||before.round!==after.round||before.turn.player!==player||after.turn.player!==player||before.turn.slot!==after.turn.slot)
  return '筹备、回合或结算阶段已变化，不能悔棋';
 // Fail closed at every shuffled/hidden source, even when an action is public.
 for(const key of ['rng','staffDeck','staffDiscard','guestDeck','guestDiscard','market'])if(!equal(before[key],after[key]))return '操作涉及随机或隐藏信息，不能悔棋';
 for(const p of after.players){
  const old=before.players.find(q=>q.id===p.id);if(!old)return '操作涉及隐藏信息，不能悔棋';
  const remaining=[...old.hand];for(const card of p.hand){const i=remaining.indexOf(card);if(i<0)return '操作揭示了新的手牌信息，不能悔棋';remaining.splice(i,1);}
 }
 const offers=g=>g.pending.flatMap(f=>f.effects.filter(e=>e.cards!==undefined).map(e=>({owner:f.owner,cards:e.cards})));
 if(!equal(offers(before),offers(after)))return '操作涉及秘密选牌信息，不能悔棋';
 return '';
}
export function undoView(room,player){
 const h=room.undoHistory;
 if(!h)return {available:false,reason:room.undoReason||'没有可撤销的操作'};
 if(h.player!==player||room.game?.turn?.player!==player)return {available:false,reason:'只能撤销当前回合自己的操作'};
 const reason=barrier(h.game,room.game,player);return {available:!reason,reason};
}
export function rememberUndo(room,before,player){
 const reason=barrier(before,room.game,player);
 room.undoHistory=reason?null:{player,game:before};room.undoReason=reason;
}
export function restoreUndo(room,player){
 const state=undoView(room,player);if(!state.available)throw new Error(state.reason);
 room.game=room.undoHistory.game;room.undoHistory=null;room.undoReason='上一步已撤销，不能连续悔棋';
}
