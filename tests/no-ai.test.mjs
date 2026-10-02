import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createApp} from '../server.mjs';

test('human-only build has no bot entry, bot capability or automatic seats',async()=>{
 const root=fileURLToPath(new URL('../.local/tests/no-ai/',import.meta.url));
 await mkdir(root,{recursive:true});const dataDir=await mkdtemp(root+'no-ai-');
 const app=await createApp({dataDir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 try {
  const health=await fetch(base+'/api/health').then(r=>r.json());
  assert.ok(!health.features?.includes('bots'),'bot capability must be removed');
  const script=await fetch(base+'/app.mjs').then(r=>r.text());
  assert.doesNotMatch(script,/人机练习|add-bot|remove-bot|botsEnabled/);
  const result=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Rollback test',bots:3})});
  assert.equal(result.status,200);const session=await result.json();
  const auth={Authorization:`Bearer ${session.token}`};
  const state=await fetch(base+`/api/rooms/${session.code}`,{headers:auth}).then(r=>r.json());
  assert.equal(state.seats.length,1);assert.ok(!state.seats.some(s=>s.bot));
  const denied=await fetch(base+`/api/rooms/${session.code}/action`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({action:{type:'add-bot'},revision:state.revision,requestId:'no-ai-check'})});
  assert.ok(denied.status>=400,'bot command must not be accepted');
 } finally {await app.close();await rm(dataDir,{recursive:true,force:true});}
});
