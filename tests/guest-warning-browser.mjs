import {chromium} from 'playwright';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createGame,act} from '../engine.mjs';
const root=fileURLToPath(new URL('../.local/tests/guest-warning/',import.meta.url));await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'run-'));
const seats=[{id:'p',name:'甲',token:'a'.repeat(64),ready:true},{id:'q',name:'乙',token:'b'.repeat(64),ready:true}];let game=createGame(seats,42);while(game.phase==='setup')game=act(game,game.setupOrder[game.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});game.dice[5]=2;game.dice[3]=2;
const owner=seats.find(s=>s.id===game.turn.player),rooms={};for(const [code,recruited] of [['NO0000',false],['HAD000',true]])rooms[code]={code,host:owner.id,seats,created:1,revision:0,game:recruited?act(game,owner.id,{type:'guest',guest:0}):game,receipts:{}};
await writeFile(path.join(dir,'rooms.json'),JSON.stringify(rooms));const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:dir});
const read=async code=>fetch(base+'/api/rooms/'+code,{headers:{Authorization:`Bearer ${owner.token}`}}).then(r=>r.json());
try{
 const checks=[],errors=[];
 for(const code of Object.keys(rooms)){
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(s=>localStorage.setItem('gah.sessions',JSON.stringify({[s.code]:s})),{code,token:owner.token,player:owner.id});const page=await context.newPage();page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/#'+code);await page.locator('.hotel-building').first().waitFor();
  const before=await read(code);let prompts=0,posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/action'))posts++;});
  if(code==='NO0000'){
   await page.locator('[data-action=die][data-face="6"]').click();await page.locator('select[name=target]').selectOption('4');await page.locator('input[name=boost]').check();
   page.once('dialog',async d=>{prompts++;assert.equal(d.type(),'confirm');assert.match(d.message(),/尚未接待/);assert.match(d.message(),/不能.*普通接待/);await d.dismiss();});await page.locator('[data-action=confirm-die]').click();assert.equal(prompts,1,'unrecruited turn must ask before taking die');assert.equal(posts,0);assert.deepEqual(await read(code),before);assert.equal(await page.locator('select[name=target]').inputValue(),'4');assert.equal(await page.locator('input[name=boost]').isChecked(),true);checks.push('cancel warns and preserves state, target and boost without request');
   page.once('dialog',async d=>{prompts++;await d.accept();});await page.locator('[data-action=confirm-die]').click();await page.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='1');assert.equal(prompts,2);assert.equal(posts,1);const after=await read(code);assert.equal(after.game.turn.main,true);assert.equal(after.game.turn.guest,false);checks.push('accept submits exactly one die action');
  }else{
   page.on('dialog',async d=>{prompts++;await d.dismiss();});await page.locator('[data-action=die][data-face="4"]').click();await page.locator('[data-action=confirm-die]').click();await page.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='1');assert.equal(prompts,0,'recruited turn must not warn');assert.equal(posts,1);assert.equal((await read(code)).game.turn.main,true);checks.push('already recruited turn proceeds without extra confirmation');
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,errors,mockedRoutes:false}));
}finally{await browser.close();await app.close();await rm(dir,{recursive:true,force:true});}
