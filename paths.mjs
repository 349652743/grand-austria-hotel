import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
export function runtimePaths({projectDir=ROOT,port=Number(process.env.PORT||3210),env=process.env}={}){
 const parent=path.dirname(projectDir),candidate=path.dirname(parent);
 const inKnowledgeBase=path.basename(parent)==='repos'&&existsSync(path.join(candidate,'AGENTS.md'))&&existsSync(path.join(candidate,'wiki','index.md'));
 const base=inKnowledgeBase?candidate:projectDir;
 const dataBase=path.join(base,'.local','AgentData','GrandAustriaHotel');
 return {dataDir:env.GAH_DATA_DIR?path.resolve(env.GAH_DATA_DIR):port===3210?dataBase:`${dataBase}-${port}`,cacheDir:path.join(base,'.local','AgentData','Caches','GrandAustriaHotel','Temp')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)console.log(JSON.stringify(runtimePaths({port:Number(process.argv[2]||process.env.PORT||3210)})));
