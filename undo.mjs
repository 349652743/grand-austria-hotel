// Server-only current-turn history: game snapshots never contain room history.
// A present stack (even empty) wins over legacy data, so abandoned history cannot revive.
const history=room=>room.undoStack??(room.undoHistory?[{player:room.undoHistory.player,game:room.undoHistory.game}]:[]);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function barrier(before,after,player){
 if(before?.phase!=='playing'||after?.phase!=='playing'||!before.turn||!after.turn||before.round!==after.round||before.turn.player!==player||after.turn.player!==player||before.turn.slot!==after.turn.slot)
  return '筹备、回合或结算阶段已变化，不能悔棋';
 // Fail closed at every shuffled/hidden source, even when an action is public.
 for(const key of ['rng','staffDeck','staffDiscard','guestDeck','market'])if(!equal(before[key],after[key]))return '操作涉及随机或隐藏信息，不能悔棋';
 // Checking in only appends already-public cafe guests. Recycling/removing/reordering
 // discards is not this safe transition; deck/market/RNG changes remain barriers above.
 const oldDiscard=before.guestDiscard??[],nextDiscard=after.guestDiscard??[];
 if(nextDiscard.length<oldDiscard.length||!equal(nextDiscard.slice(0,oldDiscard.length),oldDiscard))return '操作涉及随机或隐藏信息，不能悔棋';
 const knownGuests=(before.players.find(p=>p.id===player)?.cafe??[]).map(c=>c.id);
 for(const id of nextDiscard.slice(oldDiscard.length)){const index=knownGuests.indexOf(id);if(index<0)return '操作涉及随机或隐藏信息，不能悔棋';knownGuests.splice(index,1);}
 for(const p of after.players){
  const old=before.players.find(q=>q.id===p.id);if(!old)return '操作涉及隐藏信息，不能悔棋';
  const remaining=[...old.hand];for(const card of p.hand){const i=remaining.indexOf(card);if(i<0)return '操作揭示了新的手牌信息，不能悔棋';remaining.splice(i,1);}
 }
 const offers=g=>g.pending.flatMap(f=>f.effects.filter(e=>e.cards!==undefined).map(e=>({owner:f.owner,cards:e.cards})));
 if(!equal(offers(before),offers(after)))return '操作涉及秘密选牌信息，不能悔棋';
 return '';
}
export function undoView(room,player){
 const stack=history(room),h=stack.at(-1);
 if(!h)return {available:false,reason:room.undoReason||'没有可撤销的操作',remaining:0};
 if(h.player!==player||room.game?.turn?.player!==player)return {available:false,reason:'只能撤销当前回合自己的操作',remaining:0};
 const reason=barrier(h.game,room.game,player);return {available:!reason,reason,remaining:reason?0:stack.length};
}
export function rememberUndo(room,before,player){
 const reason=barrier(before,room.game,player);
 const stack=history(room);
 const previous=stack.at(-1);
 if(reason||(previous&&(previous.player!==player||barrier(previous.game,before,player))))stack.length=0;
 if(!reason)stack.push({player,game:before});
 room.undoStack=stack;room.undoHistory=null;room.undoReason=reason;
}
export function restoreUndo(room,player){
 const state=undoView(room,player);if(!state.available)throw new Error(state.reason);
 room.undoStack=history(room);room.game=room.undoStack.pop().game;room.undoHistory=null;room.undoReason=room.undoStack.length?'':'已撤销至本回合安全起点';
}
