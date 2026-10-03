import {chromium} from 'playwright';
import {mkdir,mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {createGame,act} from '../engine.mjs';
import {OBJECTIVES,EMPERORS} from '../public/data.mjs';
const output=process.env.GAH_TEST_OUTPUT||fileURLToPath(new URL('../.local/tests/royal-art-output/',import.meta.url));
const tempRoot=fileURLToPath(new URL('../.local/tests/royal-art/',import.meta.url));await mkdir(tempRoot,{recursive:true});await mkdir(output,{recursive:true});
const dir=await mkdtemp(path.join(tempRoot,'run-'));
const seats=[{id:'host',name:'测试经理',token:'a'.repeat(64),ready:true},{id:'guest',name:'同桌',token:'b'.repeat(64),ready:true}];
let game=createGame(seats,42);while(game.phase==='setup')game=act(game,game.setupOrder[game.setupIndex],{type:'setup',guest:4,rooms:[0,1,2]});game.turn.player='host';
const rooms={};for(let i=0;i<4;i++){const code=`AR000${i}`,g=structuredClone(game);g.emperors=[EMPERORS[i],EMPERORS[i+4],EMPERORS[i+8]];g.objectives=[OBJECTIVES[i],OBJECTIVES[i+4],OBJECTIVES[i+8]].map(o=>({...o,claimed:[]}));rooms[code]={code,host:'host',seats,created:Date.now(),revision:0,game:g,receipts:{}};}
await writeFile(path.join(dir,'rooms.json'),JSON.stringify(rooms));
const app=await createApp({dataDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.server.address().port}`;
let browser;const report={checks:[],errors:[],status:'running'};
try{
 browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,downloadsPath:dir,args:['--disable-background-networking']});
 const page=await browser.newPage({viewport:{width:390,height:1000}});page.setDefaultTimeout(3000);page.on('pageerror',e=>report.errors.push(e.message));
 const checked=new Set(),sources=JSON.parse(await readFile(new URL('../public/assets/sources.json',import.meta.url),'utf8'));
 for(const width of [390,1440])for(let i=0;i<4;i++){
  const code=`AR000${i}`;await page.setViewportSize({width,height:1000});await page.goto(base);await page.evaluate(s=>localStorage.setItem('gah.sessions',JSON.stringify({[s.code]:s})),{code,token:seats[0].token,player:'host'});await page.goto(base+'/#'+code);await page.reload({waitUntil:'domcontentloaded'});await page.locator('.hotel-building').first().waitFor();
  const images=page.locator('.imperial-tile img, .objective img');assert.equal(await images.count(),6,'all emperor and objective cards show artwork');
  for(const [selector,cards,prefix] of [['.imperial-tile',rooms[code].game.emperors,'emperor'],['.objective',rooms[code].game.objectives,'objective']])for(let j=0;j<cards.length;j++){
   const el=page.locator(selector).nth(j),image=el.locator('img'),card=cards[j],file=`${prefix}-${card.id}.png`;
   assert.equal(await image.getAttribute('src'),`/assets/${file}`);assert.ok((await image.getAttribute('alt')).includes(String(card.id)));
   await image.evaluate(img=>img.decode());assert.ok(await image.evaluate(img=>img.naturalWidth>80&&img.naturalHeight>100));assert.equal(await image.evaluate(img=>getComputedStyle(img).objectFit),'contain');
   const box=await image.boundingBox();assert.ok(box.width>=55&&box.height>=60);assert.match(await el.innerText(),new RegExp((card.text||card.reward).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   if(!checked.has(file)){const entry=sources.find(s=>s.file===file);assert.ok(entry,'record image provenance');assert.equal(entry.page,prefix==='emperor'?20:19);const bytes=await readFile(new URL('../public/assets/'+file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);checked.add(file);}
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const cls of ['imperial-tiles','objectives']){const area=page.locator('.'+cls);await area.evaluate(el=>window.scrollBy(0,el.getBoundingClientRect().top-80));if(cls==='objectives')assert.ok(await area.locator('button').evaluateAll(xs=>xs.every(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;})),'claim buttons can be scrolled clear of sticky footer');await area.screenshot({path:path.join(output,`${cls}-${width}-${i}.png`)});}
  report.checks.push({width,set:i,pass:true});
 }
 assert.equal(checked.size,24);assert.deepEqual(report.errors,[]);report.artworks=checked.size;report.status='passed';console.log(JSON.stringify(report));
}finally{await writeFile(path.join(output,'royal-art-report.json'),JSON.stringify(report,null,2));await browser?.close();await app.close();await rm(dir,{recursive:true,force:true});}
