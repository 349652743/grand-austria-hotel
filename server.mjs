import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir,writeFile,rename,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {createGame,act,view} from './engine.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
import {runtimePaths} from './paths.mjs';
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const cleanName=v=>{if(typeof v!=='string'||!v.trim()||[...v.trim()].length>20||/[\u0000-\u001f\u007f]/.test(v))throw fail('昵称请使用 1–20 个可见字符');return v.trim();};
const tokenMatch=(a,b)=>typeof a==='string'&&/^[a-f0-9]{64}$/.test(a)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.pdf':'application/pdf'};
export async function createApp({dataDir=runtimePaths().dataDir,rateLimit=600}={}) {
 await mkdir(dataDir,{recursive:true});const save=path.join(dataDir,'rooms.json');let rooms={};
 // SQLite's OS-backed exclusive lock is released even after SIGKILL; never unlink it.
 const lock=new DatabaseSync(path.join(dataDir,'.writer-lock.sqlite'));
 try{lock.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE; CREATE TABLE IF NOT EXISTS owner (id INTEGER);');}catch(e){lock.close();throw new Error(`数据目录已被占用或无法锁定：${dataDir} (${e.message})`);}
 try {rooms=JSON.parse(await readFile(save,'utf8'));}catch(e){if(e.code!=='ENOENT'){lock.close();throw new Error(`无法读取存档，未覆盖原文件：${e.message}`);}}
 const streams=new Map(),limits=new Map();let mutation=Promise.resolve();
 const connected=(code,id)=>[...(streams.get(code)||[])].some(c=>c.player===id);
 const roomView=(r,player)=>({code:r.code,host:r.host,revision:r.revision,you:player,created:r.created,seats:r.seats.map(s=>({id:s.id,name:s.name,ready:s.ready,online:connected(r.code,s.id)})),game:view(r.game,player)});
 const broadcast=code=>{const r=rooms[code];for(const c of streams.get(code)||[]){if(!r?.seats.some(s=>s.id===c.player)){streams.get(code).delete(c);c.res.end();}else c.res.write(`event: state\ndata: ${JSON.stringify(roomView(r,c.player))}\n\n`);}};
 async function persist(next){const tmp=save+'.tmp';await writeFile(tmp,JSON.stringify(next),'utf8');await rename(tmp,save);rooms=next;}
 async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32768)throw fail('请求过大',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw fail('无效 JSON');}}
 function authenticate(req,r){const token=req.headers.authorization?.replace(/^Bearer /,'');const seat=r.seats.find(s=>tokenMatch(token,s.token));if(!seat)throw fail('登录凭据无效，请使用原浏览器恢复房间',401);return seat;}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try {
   const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean);
   if(parts[0]!=='api') {
    if(!['GET','HEAD'].includes(req.method))throw fail('不支持的方法',405);
    let file=decodeURIComponent(url.pathname);if(file==='/')file='/index.html';
    const publicRoot=path.join(ROOT,'public'),full=path.resolve(publicRoot,'.'+file);
    if(!full.startsWith(publicRoot+path.sep))throw fail('无效路径',404);
    let info;try{info=await stat(full);}catch{throw fail('找不到资源',404);}if(!info.isFile())throw fail('找不到资源',404);
    res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':file.startsWith('/assets/')?'public, max-age=86400':'no-cache'});
    if(req.method==='HEAD')res.end();else createReadStream(full).on('error',()=>res.destroy()).pipe(res);return;
   }
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)throw fail('不允许跨站请求',403);
   if(req.method==='GET'&&parts[1]==='health') {
    const ips=Object.values(os.networkInterfaces()).flat().filter(n=>n&&n.family==='IPv4'&&!n.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n=>n.address).sort((a,b)=>(a.startsWith('192.168.')?0:1)-(b.startsWith('192.168.')?0:1));
    return json(res,200,{ok:true,service:'grand-austria-hotel',version:'1.0.0',lanUrls:ips.map(ip=>`http://${ip}:${req.socket.localPort}`)});
   }
   const code=parts[2]?.toUpperCase();
   if(req.method==='GET'&&parts[1]==='rooms') {
    const r=rooms[code];if(!r)throw fail('房间不存在',404);const seat=authenticate(req,r);
    if(parts[3]==='events') {
     res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});res.flushHeaders();
     const set=streams.get(code)||new Set();streams.set(code,set);const c={player:seat.id,res};set.add(c);broadcast(code);
     const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);
     req.on('close',()=>{clearInterval(heartbeat);set.delete(c);if(!set.size)streams.delete(code);broadcast(code);});return;
    }
    return json(res,200,roomView(r,seat.id));
   }
   if(req.method!=='POST'||parts[1]!=='rooms')throw fail('接口不存在',404);
   const ip=req.socket.remoteAddress,now=Date.now(),limit=limits.get(ip)||{since:now,n:0};if(now-limit.since>60000){limit.since=now;limit.n=0;}limit.n++;limits.set(ip,limit);if(limit.n>rateLimit)throw fail('操作过于频繁，请稍后重试',429);
   if(!req.headers['content-type']?.startsWith('application/json'))throw fail('需要 JSON 请求',415);
   const input=await body(req);
   const task=mutation.then(async()=>{
    const next=structuredClone(rooms);
    if(!code) {
     // Finished games are logically archived in place: retain all data and credentials.
     if(Object.values(next).filter(r=>r.game?.phase!=='finished').length>=100)throw fail('已达到 100 个未结束房间；请完成旧牌局（终局自动归档释放名额），或让所有玩家离开未开局房间');
     const name=cleanName(input.name);let newCode;do{newCode=randomBytes(3).toString('hex').toUpperCase();}while(next[newCode]);
     const seat={id:randomBytes(8).toString('hex'),token:randomBytes(32).toString('hex'),name,ready:true};
     next[newCode]={code:newCode,host:seat.id,seats:[seat],created:Date.now(),revision:0,game:null,receipts:{}};await persist(next);
     return {code:newCode,token:seat.token,player:seat.id};
    }
    const r=next[code];if(!r)throw fail('房间不存在',404);
    if(parts[3]==='join') {
     if(r.game)throw fail('本局已经开始，不能中途加入');if(r.seats.length>=4)throw fail('房间已满（最多 4 人）');const name=cleanName(input.name);
     if(r.seats.some(s=>s.name===name))throw fail('该昵称已被使用');
     const seat={id:randomBytes(8).toString('hex'),token:randomBytes(32).toString('hex'),name,ready:false};r.seats.push(seat);r.revision++;await persist(next);broadcast(code);return {code,token:seat.token,player:seat.id};
    }
    const seat=authenticate(req,r);
    if(parts[3]!=='action')throw fail('接口不存在',404);
    if(typeof input.requestId!=='string'||!/^[\w-]{8,80}$/.test(input.requestId))throw fail('缺少操作编号');
    const receipt=`${seat.id}:${input.requestId}`;if(r.receipts[receipt])return roomView(rooms[code],seat.id);
    if(input.revision!==r.revision)throw fail('房间状态已经更新，请按最新状态重试',409);
    const a=input.action;
    if(!a||typeof a.type!=='string')throw fail('无效操作');
    if(a.type==='ready'){if(r.game)throw fail('比赛已开始');seat.ready=!seat.ready;}
    else if(a.type==='start'){if(seat.id!==r.host)throw fail('只有房主可以开始');if(r.game)throw fail('比赛已开始');if(r.seats.length<2||r.seats.some(s=>!s.ready))throw fail('至少 2 人且所有玩家准备后才可开始');r.game=createGame(r.seats,randomInt(1,4294967295));}
    else if(a.type==='leave'){if(r.game)throw fail('进行中的席位保留，关闭页面后可用原浏览器继续');r.seats=r.seats.filter(s=>s.id!==seat.id);if(!r.seats.length){delete next[code];await persist(next);broadcast(code);return {left:true};}if(r.host===seat.id)r.host=r.seats[0].id;}
    else {if(!r.game)throw fail('比赛尚未开始');r.game=act(r.game,seat.id,a);}
    r.revision++;r.receipts[receipt]=r.revision;const keys=Object.keys(r.receipts);for(const key of keys.slice(0,Math.max(0,keys.length-1000)))delete r.receipts[key];
    await persist(next);broadcast(code);return a.type==='leave'?{left:true}:roomView(r,seat.id);
   });
   mutation=task.catch(()=>{});json(res,200,await task);
  }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.message});else res.end();}
 });
 server.on('close',()=>{for(const set of streams.values())for(const c of set)c.res.end();streams.clear();});
 const cleanup=setInterval(()=>{for(const [ip,v] of limits)if(Date.now()-v.since>120000)limits.delete(ip);},60000);cleanup.unref();
 let closing;
 return {server,close:()=>closing??=(async()=>{clearInterval(cleanup);await mutation;for(const set of streams.values())for(const c of set)c.res.end();await new Promise(resolve=>server.close(resolve));lock.close();})()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 const port=Number(process.env.PORT||3210),host=process.env.HOST||'0.0.0.0';const app=await createApp({dataDir:runtimePaths({port}).dataDir});const {server}=app;
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().catch(e=>{console.error(e.message);process.exitCode=1;}));
 server.listen(port,host,()=>{console.log(`Grand Austria Hotel · http://localhost:${port}`);for(const list of Object.values(os.networkInterfaces()))for(const nic of list||[])if(nic.family==='IPv4'&&!nic.internal)console.log(`LAN: http://${nic.address}:${port}`);});
 server.on('error',async e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用，请设置 PORT 后重试。`:e.message);process.exitCode=1;await app.close();});
}
