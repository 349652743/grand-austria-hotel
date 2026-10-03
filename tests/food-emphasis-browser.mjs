import {chromium} from 'playwright';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createGame,act} from '../engine.mjs';
import {GUESTS} from '../public/data.mjs';
const output=process.env.GAH_TEST_OUTPUT||fileURLToPath(new URL('../.local/tests/food-emphasis-output/',import.meta.url));
const tempRoot=fileURLToPath(new URL('../.local/tests/food-emphasis/',import.meta.url));await mkdir(tempRoot,{recursive:true});await mkdir(output,{recursive:true});
const dir=await mkdtemp(path.join(tempRoot,'run-'));
const seats=[{id:'host',name:'测试经理',token:'a'.repeat(64),ready:true},{id:'guest',name:'同桌',token:'b'.repeat(64),ready:true}];
let game=createGame(seats,42);while(game.phase==='setup')game=act(game,game.setupOrder[game.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});
game.turn.player='host';game.players[0].kitchen=[6,6,6,6];
const guest=Object.values(GUESTS).find(c=>c.order[0]>=2&&c.order.some(n=>n===0));
game.players[0].cafe=[{id:guest.id,served:guest.order.map(n=>n?1:0)}];
const rooms={};for(const [i,effect] of [null,{type:'food',food:0,n:6},{type:'dishes',pair:0,n:5},{type:'anyFood',n:5}].entries()) {const code=`AF000${i}`,g=structuredClone(game);if(effect)g.pending=[{owner:'host',label:'测试餐饮奖励',effects:[effect]}];rooms[code]={code,host:'host',seats,created:Date.now(),revision:0,game:g,receipts:{}};}
await writeFile(path.join(dir,'rooms.json'),JSON.stringify(rooms));
const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
let browser;const report={checks:[],errors:[],status:'running'};
try{
 browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:dir,args:['--disable-background-networking']});
 const page=await browser.newPage({viewport:{width:390,height:1000}});page.setDefaultTimeout(3000);page.on('pageerror',e=>report.errors.push(e.message));
 for(const width of [390,1440])for(let i=0;i<4;i++){
  const code=`AF000${i}`;await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(s=>localStorage.setItem('gah.sessions',JSON.stringify({[s.code]:s})),{code,token:seats[0].token,player:'host'});await page.goto(base+'/#'+code);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.hotel-building').first().waitFor();if(i===0)await page.locator('[data-action=serve]').click();
  const cells=page.locator('.allocation-table tbody tr').first().locator('td').filter({has:page.locator('.order-detail')});assert.equal(await cells.count(),4);
  for(let food=0;food<4;food++){
   const cell=cells.nth(food),missing=guest.order[food]-(guest.order[food]?1:0);
   assert.equal(await cell.getAttribute('data-missing'),String(missing),'actual remaining demand must be explicit');
   assert.ok((await cell.getAttribute('class')).includes(missing?'order-needed':'order-satisfied'));
   if(!missing){assert.match(await cell.innerText(),/已满足|无需/);assert.equal(await cell.locator('button:enabled').count(),0);}
   else assert.match(await cell.innerText(),new RegExp(`仍缺 ${missing}`));
  }
  const colors=await cells.evaluateAll(xs=>xs.map(el=>({missing:Number(el.dataset.missing),background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('.order-detail b')).color})));
  assert.notEqual(colors.find(c=>c.missing).background,colors.find(c=>!c.missing).background);assert.notEqual(colors.find(c=>c.missing).color,colors.find(c=>!c.missing).color);
  await page.locator('[data-action=quantity][data-delta="1"]:not(:disabled)').last().click();assert.equal(await page.locator('.allocation-table input').evaluateAll(xs=>xs.reduce((n,x)=>n+Number(x.value),0)),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('.modal').screenshot({path:path.join(output,`food-${width}-${i}.png`)});
  report.checks.push({width,mode:i,pass:true});
 }
 assert.deepEqual(report.errors,[]);report.status='passed';console.log(JSON.stringify(report));
}finally{await writeFile(path.join(output,'food-emphasis-report.json'),JSON.stringify(report,null,2));await browser?.close();await app.close();await rm(dir,{recursive:true,force:true});}
