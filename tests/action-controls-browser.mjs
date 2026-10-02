import {chromium} from 'playwright';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createGame,act} from '../engine.mjs';
const root=fileURLToPath(new URL('../.local/tests/action-controls/',import.meta.url));await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'run-'));
const seats=[{id:'p',name:'甲',token:'a'.repeat(64),ready:true},{id:'q',name:'乙',token:'b'.repeat(64),ready:true}];let game=createGame(seats,42);while(game.phase==='setup')game=act(game,game.setupOrder[game.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});
const owner=seats.find(s=>s.id===game.turn.player),code='ABCDEF';await writeFile(path.join(dir,'rooms.json'),JSON.stringify({[code]:{code,host:owner.id,seats,created:1,revision:0,game,receipts:{}}}));
const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:dir});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(s=>localStorage.setItem('gah.sessions',JSON.stringify({[s.code]:s})),{code,token:owner.token,player:owner.id});const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/#'+code);await page.locator('.hotel-building').first().waitFor();
 const mode=process.argv[2]||'all',checks=[];
 if(['all','undo'].includes(mode)){assert.equal(await page.locator('[data-action=undo]').isVisible(),false,'unavailable undo must not be visible');checks.push('unavailable undo hidden');}
 if(['all','color'].includes(mode)){const colors=await page.locator('[data-action=pass]').evaluate(el=>({button:getComputedStyle(el).backgroundColor,body:getComputedStyle(document.body).backgroundColor}));assert.notEqual(colors.button,'rgba(0, 0, 0, 0)','pass button needs an opaque background');assert.notEqual(colors.button,colors.body);checks.push('pass button has contrasting opaque background');}
 if(process.env.GAH_TEST_OUTPUT){await mkdir(process.env.GAH_TEST_OUTPUT,{recursive:true});await page.locator('.action-footer').screenshot({path:path.join(process.env.GAH_TEST_OUTPUT,'action-footer-390.png')});}
 if(['all','pass'].includes(mode)){let prompts=0;page.once('dialog',async d=>{prompts++;assert.equal(d.type(),'confirm');assert.match(d.message(),/暂缓/);await d.dismiss();});await page.locator('[data-action=pass]').click();assert.equal(prompts,1,'pass must ask before submitting');assert.equal(await page.locator('#app').getAttribute('data-revision'),'0','cancel leaves state unchanged');page.once('dialog',async d=>{prompts++;await d.accept();});await page.locator('[data-action=pass]').click();await page.waitForFunction(()=>document.querySelector('#app')?.dataset.revision==='1');assert.equal(prompts,2);assert.equal(await page.locator('[data-action=pass]').isDisabled(),true);checks.push('pass cancel leaves state unchanged; accept advances exactly once');}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,errors}));
}finally{await browser.close();await app.close();await rm(dir,{recursive:true,force:true});}
