import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
test('sound feature is removed from the client',async()=>{const source=await readFile(new URL('../public/app.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/sound\.mjs|playFeedback|sound-toggle|AudioContext/);await assert.rejects(access(new URL('../public/sound.mjs',import.meta.url)),{code:'ENOENT'});});
