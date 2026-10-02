import {chromium} from 'playwright';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {actor,decide} from './bot.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local/tests/browser');
const tempRoot=path.join(root,'tmp/grand-austria-hotel/tests');await mkdir(tempRoot,{recursive:true});
const temp=await mkdtemp(path.join(tempRoot,'browser-'));const output=path.join(root,'output/grand-austria-hotel/validation');await mkdir(output,{recursive:true});
const app=await createApp({dataDir:temp});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({executablePath:process.env.GAH_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking'],downloadsPath:temp});
const errors=[],failures=[],contexts=[],pages=[];let checks=[];
const getSession=page=>page.evaluate(()=>{const code=location.hash.slice(1);return JSON.parse(localStorage.getItem('gah.sessions'))[code];});
const getState=async(page)=>{const s=await getSession(page);return fetch(`${base}/api/rooms/${s.code}`,{headers:{Authorization:`Bearer ${s.token}`}}).then(r=>r.json());};
try {
 for(let i=0;i<4;i++){const context=await browser.newContext({viewport:i===3?{width:390,height:844}:{width:1440,height:1050},deviceScaleFactor:1});contexts.push(context);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/api/'))failures.push(`${r.status()} ${r.url()}`);});pages.push(page);await page.goto(base);}
 await pages[0].screenshot({path:path.join(output,'01-welcome-desktop.png'),fullPage:true});
 await pages[3].screenshot({path:path.join(output,'02-welcome-mobile.png'),fullPage:true});
 const names=['利奥波德','艾米莉亚','弗朗茨','索菲亚'];await pages[0].locator('#nickname').fill(names[0]);await pages[0].getByRole('button',{name:/创建私人牌桌/}).click();await pages[0].locator('.room-code').waitFor();
 const code=(await pages[0].locator('.room-code').innerText()).trim();
 for(let i=1;i<4;i++){await pages[i].locator('#nickname').fill(names[i]);await pages[i].locator('#room-code').fill(code);await pages[i].getByRole('button',{name:'加入牌桌'}).click();await pages[i].locator('.room-code').waitFor();await pages[i].getByRole('button',{name:'准备好了',exact:true}).click();await pages[i].getByRole('button',{name:'取消准备',exact:true}).waitFor();}
 await pages[0].screenshot({path:path.join(output,'03-four-player-lobby.png'),fullPage:true});checks.push('4 independent browser profiles join and ready via visible UI');
 await pages[0].getByRole('button',{name:'开始营业 →'}).click();
 for(let i=0;i<4;i++){let state;for(let attempt=0;attempt<30;attempt++){state=await getState(pages[0]);if(state.game?.phase==='setup')break;await new Promise(r=>setTimeout(r,50));}const owner=actor(state.game);let idx=-1;for(let k=0;k<4;k++)if((await getSession(pages[k])).player===owner)idx=k;assert.ok(idx>=0);await pages[idx].getByRole('button',{name:'酒店准备好了 →'}).click();await pages[idx].getByRole('dialog').waitFor({state:'hidden'});}
 for(const p of pages)await p.locator('.dice-grid').waitFor();checks.push('all four players choose opening guests and rooms through UI');
 let state=await getState(pages[0]);let idx=0;for(let i=0;i<4;i++)if((await getSession(pages[i])).player===actor(state.game))idx=i;
 const active=pages[idx];const available=state.game.dice.findIndex((n,i)=>n&&i<5)+1;await active.locator(`[data-action="die"][data-face="${available}"]`).click();await active.getByRole('button',{name:'取走骰子 →'}).click();await active.locator('[data-action="resolve"]').waitFor();
 if(available<=2){await active.getByRole('button',{name:'优先满足已有订单 ↗'}).click();await active.locator('[data-action="resolve"]').click();}
 else if(available===3){await active.locator('.modal .room.selectable:not(:disabled)').first().click();await active.locator('[data-action="resolve"]').click();while(await active.locator('[data-action="skip-effect"]').count())await active.locator('[data-action="skip-effect"]').click();}
 else if(available===4)await active.locator('[data-action="resolve"]').click();
 else{await active.locator('.modal .select-staff .staff-card:not(.disabled)').first().click();await active.locator('[data-action="resolve"]').click();}
 // Resolve any staff follow-ups using the real server, then end the turn through UI.
 const sessions=await Promise.all(pages.map(getSession));let serial=0;
 async function httpStep(v){const who=actor(v.game),s=sessions.find(s=>s.player===who),current=await fetch(`${base}/api/rooms/${code}`,{headers:{Authorization:`Bearer ${s.token}`}}).then(r=>r.json());const choice=decide(current.game);const r=await fetch(`${base}/api/rooms/${code}/action`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${s.token}`},body:JSON.stringify({requestId:`browser-step-${++serial}`,revision:current.revision,action:choice})});const out=await r.json();assert.equal(r.status,200,JSON.stringify(out));return out;}
 state=await getState(active);while(state.game.pending.length)state=await httpStep(state);
 await active.getByRole('button',{name:'结束回合 →'}).click();checks.push('dice selection, reward allocation and end turn through UI');
 await pages[0].screenshot({path:path.join(output,'04-table-desktop.png'),fullPage:true});await pages[3].screenshot({path:path.join(output,'05-table-mobile.png'),fullPage:true});
 for(const page of pages){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'No horizontal viewport overflow');}
 checks.push('desktop 1440px and mobile 390px render without horizontal overflow');
 await pages[2].reload();await pages[2].locator('.dice-grid').waitFor();assert.equal((await getSession(pages[2])).player,sessions[2].player);checks.push('reload resumes original authenticated seat');
 await contexts[3].setOffline(true);state=await getState(pages[0]);state=await httpStep(state);await contexts[3].setOffline(false);await pages[3].waitForFunction(revision=>Number(document.querySelector('#app').dataset.revision)>=revision,state.revision,{timeout:20000});checks.push('offline browser automatically reconnects to latest state without page reload');
 state=await getState(pages[0]);for(let i=0;i<2500&&state.game.phase!=='finished';i++)state=await httpStep(state);assert.equal(state.game.phase,'finished');
 for(const p of pages)await p.locator('.endgame').waitFor();await pages[0].screenshot({path:path.join(output,'06-final-scoring.png'),fullPage:true});checks.push(`all four browsers receive final scoring after seven rounds (${serial} HTTP commands)`);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);checks.push('zero browser JavaScript errors and zero failed static resources');
 await writeFile(path.join(output,'browser-results.json'),JSON.stringify({date:new Date().toISOString(),checks,errors,failures},null,2));console.log(JSON.stringify({checks,errors,failures},null,2));
}catch(e){const debug=[];for(let i=0;i<pages.length;i++){try{await pages[i].screenshot({path:path.join(output,`debug-${i}.png`),fullPage:true});debug.push(await pages[i].evaluate(()=>({url:location.href,storage:localStorage.getItem('gah.sessions'),text:document.body.innerText})));}catch{}}await writeFile(path.join(tempRoot,'last-browser-failure.json'),JSON.stringify({message:e.message,errors,failures,debug},null,2));throw e;}
finally{await browser.close();await app.close();assert.ok(path.resolve(temp).startsWith(tempRoot+path.sep));await rm(temp,{recursive:true,force:true});}
