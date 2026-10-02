import {chromium} from 'playwright';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';
import {createGame,act} from '../engine.mjs';
import {GUESTS} from '../public/data.mjs';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../.local/tests/scroll-browser/',import.meta.url));await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'run-'));
const output=process.env.GAH_TEST_OUTPUT||root;await mkdir(output,{recursive:true});
const seats=[{id:'p',name:'甲',token:'a'.repeat(64),ready:true},{id:'q',name:'乙',token:'b'.repeat(64),ready:true}];
const setup=createGame(seats,42);let game=structuredClone(setup);while(game.phase==='setup')game=act(game,game.setupOrder[game.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});
const owner=game.turn.player,p=game.players.find(p=>p.id===owner);p.hand=Array.from({length:48},(_,i)=>i+1);p.kitchen=[6,6,6,6];p.cafe=[{id:59,served:[0,0,0,0]}];game.log=Array.from({length:35},(_,i)=>({round:1,text:'滚动测试记录 '+i}));
p.rooms[0]=2;p.roomGuests=Array(20).fill(null);p.roomGuests[0]=59;const opponent=game.players.find(q=>q.id!==owner);opponent.rooms[0]=2;delete opponent.roomGuests;
const hire=structuredClone(game);hire.pending=[{owner,label:'员工选择',effects:[{type:'offer',cards:p.hand,discount:99}]}];
const effects=structuredClone(game);effects.pending=[{owner,label:'长效果列表',effects:Array.from({length:20},()=>({type:'dishes',pair:0,n:4}))}];
const rooms={};for(const [code,g] of [['AAAAAA',setup],['BBBBBB',game],['CCCCCC',hire],['DDDDDD',effects]])rooms[code]={code,host:'p',seats,created:1,revision:0,game:g,receipts:{}};
await writeFile(path.join(dir,'rooms.json'),JSON.stringify(rooms));const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:dir});const checks=[],errors=[];
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
async function open(code,id=owner){await page.addInitScript(s=>{if(location.protocol.startsWith('http'))localStorage.setItem('gah.sessions',JSON.stringify({[s.code]:s}));},{code,token:seats.find(s=>s.id===id).token,player:id});await page.goto('about:blank');await page.goto(base+'/#'+code);await page.locator('.hotel-building').first().waitFor();}
async function check(name,selectors,action){const before=await page.evaluate(ss=>ss.map(s=>{const el=s==='window'?document.scrollingElement:document.querySelector(s);el.scrollTop=180;el.scrollLeft=130;return {selector:s,top:el.scrollTop,left:el.scrollLeft};}),selectors);await action();await page.waitForTimeout(100);const after=await page.evaluate(ss=>ss.map(s=>{const el=s==='window'?document.scrollingElement:document.querySelector(s);return {selector:s,top:el.scrollTop,left:el.scrollLeft};}),selectors);checks.push({width,name,before,after,pass:JSON.stringify(before)===JSON.stringify(after)&&before.some(v=>v.top||v.left)});}
await open('AAAAAA',setup.setupOrder[0]);await check('setup outer modal', ['.modal'],()=>page.locator('[data-action=setup-guest]').last().evaluate(e=>e.click()));
// Stress both axes of real list containers, independent of current responsive breakpoints.
await page.addStyleTag({content:'.market{display:flex!important;max-width:250px;overflow:auto}.market>.guest-card{flex:0 0 160px}'});await check('setup market horizontal',['#overlay .market','.modal'],()=>page.locator('[data-action=setup-guest]').last().evaluate(e=>e.click()));
await open('CCCCCC');await page.addStyleTag({content:'.select-staff{max-height:180px;overflow:auto}'});await check('staff selection list and modal',['.select-staff','.modal'],()=>page.locator('[data-action=select-staff]').nth(20).evaluate(e=>e.click()));await check('return-up retains list',['.select-staff','.modal'],()=>page.locator('[data-action=return-up]').last().evaluate(e=>e.click()));
await open('DDDDDD');await page.addStyleTag({content:'.effects-list{max-height:140px;overflow:auto}'});await check('effects list on full render',['.effects-list','.modal'],()=>page.locator('[data-action=player]').first().evaluate(e=>e.click()));
await page.locator('[data-action=effect]').last().evaluate(e=>e.click());assert.equal(await page.locator('.modal').evaluate(e=>e.scrollTop),0,'different effect starts at top');await page.addStyleTag({content:'.modal{max-height:300px}'});await check('select rerender preserves modal',['.modal'],()=>page.locator('[data-change=secondary]').evaluate(e=>{e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}));}));
await open('BBBBBB');await page.addStyleTag({content:'.players-strip{display:flex!important;max-width:200px;overflow:auto}.player-tab{flex:0 0 170px}#app .market{display:flex!important;max-width:250px;overflow:auto}#app .market>.guest-card{flex:0 0 160px}'});await check('board horizontal lists',['#app .market','.players-strip'],()=>page.locator(`[data-action=player][data-id="${owner}"]`).evaluate(e=>e.click()));
await check('log and document on render',['.log-panel','window'],()=>page.locator('[data-action=player]').first().evaluate(e=>e.click()));
// A real server action delivered by SSE must preserve unrelated board scrolling.
await check('SSE render keeps board and window',['.log-panel','#app .market','.players-strip','window'],async()=>{const token=seats.find(s=>s.id===owner).token;const state=await fetch(base+'/api/rooms/BBBBBB',{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());const response=await fetch(base+'/api/rooms/BBBBBB/action',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,requestId:crypto.randomUUID(),action:{type:'serve',allocations:[{guest:59,food:0,count:1}]}})});assert.equal(response.status,200);await page.waitForFunction(rev=>document.querySelector('#app').dataset.revision===String(rev),state.revision+1);});
await page.locator('[data-action=serve]').evaluate(e=>e.click());await page.addStyleTag({content:'.modal{max-height:300px}'});await check('quantity modal',['.modal'],()=>page.locator('[data-action=quantity][data-delta="1"]:not(:disabled)').first().evaluate(e=>e.click()));
await page.locator('[data-action=close]').first().evaluate(e=>e.click());
await page.locator(`[data-action=player][data-id="${owner}"]`).evaluate(e=>e.click());
assert.equal(await page.locator('[data-action=room-guest]').count(),1,'occupied room exposes guest detail');await page.locator('[data-action=room-guest]').click();assert.equal(await page.locator('#modal-title').textContent(),GUESTS[59].name);await page.locator('[data-action=close]').first().click();
await page.locator(`[data-action=player][data-id="${opponent.id}"]`).click();await page.locator('[data-action=room-guest]').click();assert.match(await page.locator('.modal').textContent(),/入住客人未记录/);await page.locator('[data-action=close]').first().click();
assert.equal(await page.locator('[data-action=sound-toggle]').count(),0);
checks.push({width,name:'occupied guest, legacy unknown, and sound toggle absent',pass:true});
await page.screenshot({path:path.join(output,`scroll-${width}.png`)});await context.close();}
}catch(error){errors.push(error.stack||String(error));}finally{await browser.close();await app.close();await rm(dir,{recursive:true,force:true});}
const report={status:checks.every(c=>c.pass)&&!errors.length?'passed':'failed',browser:'real Chrome',mockedRoutes:false,layoutStress:'Horizontal markets/player tabs, staff/effects lists and quantity/select modals use test-only overflow size constraints; setup modal, log and document also exercise natural scrolling.',checks,errors};await writeFile(path.join(output,'scroll-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.status!=='passed')process.exitCode=1;
