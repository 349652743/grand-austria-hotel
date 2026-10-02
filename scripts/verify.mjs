import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GUESTS,STAFF} from '../public/data.mjs';
const base=new URL('../public/assets/',import.meta.url),sources=JSON.parse(await readFile(new URL('sources.json',base),'utf8'));
let count=0;
for(const card of [...Object.values(GUESTS),...Object.values(STAFF)]) {
 const file=card.image.split('/').at(-1),entry=sources.find(s=>s.file===file);
 if(!entry)throw new Error(`Missing provenance for ${file}`);
 const data=await readFile(new URL(file,base));if(createHash('sha256').update(data).digest('hex')!==entry.sha256)throw new Error(`Asset hash mismatch: ${file}`);count++;
}
for(const file of ['index.html','style.css','app.mjs','data.mjs'])await stat(new URL('../public/'+file,import.meta.url));
console.log(`Verified ${count} card images with provenance and SHA-256; client entry points exist.`);
