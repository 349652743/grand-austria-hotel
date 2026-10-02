import {chromium} from 'playwright';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createGame,act} from '../engine.mjs';
const root=fileURLToPath(new URL('../.local/tests/undo-browser/',import.meta.url));await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'run-'));
const seats=[{id:'p',name:'甲',token:'a'.repeat(64),ready:true},{id:'q',name:'乙',token:'b'.repeat(64),ready:true}];
let game=createGame(seats,42);while(game.phase==='setup')game=act(game,game.setupOrder[game.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});
const active=seats.find(s=>s.id===game.turn.player),other=seats.find(s=>s.id!==active.id),player=game.players.find(p=>p.id===active.id);player.kitchen=[6,6,6,6];player.cafe=[{id:59,served:[0,0,0,0]}];
game.dice[0]=1;
const code='ABCDEF';await writeFile(path.join(dir,'rooms.json'),JSON.stringify({[code]:{code,host:'p',seats,created:1,revision:0,game,receipts:{}}}));
const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:dir});const errors=[];
const state=async()=>fetch(base+'/api/rooms/'+code,{headers:{Authorization:`Bearer ${active.token}`}}).then(r=>r.json());
try{
 const pages=[];for(const seat of [active,other]){const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(s=>localStorage.setItem('gah.sessions',JSON.stringify({[s.code]:s})),{code,token:seat.token,player:seat.id});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);await page.goto(base+'/#'+code);await page.locator('.hotel-building').first().waitFor();pages.push(page);}
 const [owner,peer]=pages,before=await state();await owner.locator('[data-action=serve]').click();await owner.locator('[data-action=quantity][data-delta="1"]:not(:disabled)').first().click();await owner.locator('[data-action=confirm-serve]').click();
 for(const page of pages)await page.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='1');
 const changed=await state();assert.equal(changed.undo.available,true);assert.notDeepEqual(changed.game,before.game);assert.equal(await peer.locator('[data-action=undo]').isDisabled(),true);
 // Offline serve is intentionally disabled; open the draft first, then dispatch the player-tab rerender beneath its overlay.
 await owner.locator('[data-action=serve]').click();await owner.context().setOffline(true);app.server.closeAllConnections();await owner.locator('.connection.offline').waitFor();await owner.locator('[data-action=player]').first().evaluate(el=>el.click());
 assert.equal(await owner.locator('[data-action=undo]').isDisabled(),true);
 await owner.locator('[data-action=quantity][data-delta="1"]:not(:disabled)').first().click();
 const draft=await owner.locator('#modal-form').innerHTML();await owner.context().setOffline(false);await owner.locator('.connection:not(.offline)').waitFor();
 assert.equal(await owner.locator('[data-action=undo]').isDisabled(),false,'same-revision reconnect must re-enable undo');assert.equal(await owner.locator('#modal-form').innerHTML(),draft,'reconnect preserves draft');assert.equal((await state()).revision,1);await owner.locator('[data-action=close]').first().click();
 owner.once('dialog',d=>d.dismiss());await owner.locator('[data-action=undo]').click();assert.equal((await state()).revision,1);
 owner.once('dialog',d=>d.accept());await owner.locator('[data-action=undo]').click();for(const page of pages)await page.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='2');
 const restored=await state();assert.deepEqual(restored.game,before.game);assert.equal(restored.undo.available,false);assert.equal(await owner.locator('[data-action=undo]').isDisabled(),true);assert.deepEqual(errors,[]);
 await owner.locator('[data-action=die][data-face="1"]').click();await owner.locator('[data-action=confirm-die]').click();await owner.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='3');
 assert.equal(await owner.locator('#overlay [data-action=undo]').count(),1,'pending modal must expose undo');assert.equal(await peer.locator('#overlay [data-action=undo]').count(),0);
 assert.equal(await owner.locator('#overlay [data-action=undo]').isEnabled(),true);assert.equal(await owner.locator('[id]').evaluateAll(els=>new Set(els.map(e=>e.id)).size===els.length),true,'IDs remain unique');owner.once('dialog',d=>d.accept());await owner.locator('#overlay [data-action=undo]').click();for(const page of pages)await page.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='4');assert.deepEqual((await state()).game,before.game);assert.equal(await owner.locator('#overlay .modal').count(),0);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'passed',checks:['same-revision reconnect re-enables undo after offline player-tab rerender','draft +1 survives reconnect without form replacement','owner pending detail modal exposes clickable undo','pending dice undo restores exact game in both clients','multiple undo descriptions have unique IDs','real UI kitchen stepper and paid service','non-owner undo disabled','undo cancellation unchanged','confirmed server undo restores exact game','both browsers receive newer SSE revision','single-step consumed and no JS errors'],mockedRoutes:false}));
}finally{await browser.close();await app.close();await rm(dir,{recursive:true,force:true});}
