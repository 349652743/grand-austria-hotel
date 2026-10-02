// Short synthesized UI cues: no downloads, background music or remote events.
export function createFeedbackAudio(scope=globalThis){
 let enabled=true,context=null,last=-Infinity;
 try{enabled=scope.localStorage?.getItem('gah.sound')!=='off';}catch{}
 const now=()=>scope.performance?.now?.()??Date.now();
 function activate(event){
  if(!enabled||!event?.isTrusted)return;
  try{const Audio=scope.AudioContext||scope.webkitAudioContext;if(!Audio)return;context??=new Audio();if(context.state==='suspended')context.resume().catch(()=>{});}catch{context=null;}
 }
 scope.document?.addEventListener('pointerdown',activate,{capture:true,passive:true});
 scope.document?.addEventListener('keydown',activate,{capture:true});
 function soundEnabled(){return enabled;}
 function setSoundEnabled(value){enabled=Boolean(value);try{scope.localStorage?.setItem('gah.sound',enabled?'on':'off');}catch{}}
 function playFeedback(type){
  if(!enabled||!context||context.state!=='running'||scope.document?.visibilityState==='hidden'||now()-last<120)return false;
  // Only confirmed local game actions have cues. Repaints, taps and SSE stay quiet.
  const patterns={die:[[440,0,.055],[620,.035,.055]],serve:[[660,0,.08]],checkin:[[523,0,.12],[784,.055,.12]],claim:[[660,0,.10],[880,.045,.10]],undo:[[440,0,.075],[330,.04,.08]],resolve:[[590,0,.065]],guest:[[520,0,.075]],staff:[[620,0,.075]],end:[[370,0,.07]],pass:[[350,0,.06]],setup:[[520,0,.08]]};
  const notes=patterns[type];if(!notes)return false;
  try{last=now();for(const [frequency,delay,duration] of notes){const osc=context.createOscillator(),gain=context.createGain(),start=context.currentTime+delay;osc.type='sine';osc.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(0.0001,start);gain.gain.linearRampToValueAtTime(0.018,start+.008);gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);osc.connect(gain);gain.connect(context.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+.015);}return true;}catch{return false;}
 }
 return {playFeedback,soundEnabled,setSoundEnabled};
}
export const {playFeedback,soundEnabled,setSoundEnabled}=createFeedbackAudio();
