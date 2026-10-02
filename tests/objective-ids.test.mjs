import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECTIVES} from '../public/data.mjs';

test('2022 official p.19 spatial card IDs match all 12 objective criteria',()=>{
 const expected={105:'money',106:'prepared',107:'staff',108:'emperor',109:'rows',110:'groups',111:'color',112:'cols',113:'rgb',114:'ry',115:'yb',116:'br'};
 assert.equal(OBJECTIVES.length,12);
 assert.equal(new Set(OBJECTIVES.map(o=>o.id)).size,12);
 assert.deepEqual(Object.fromEntries(OBJECTIVES.map(o=>[o.id,o.test])),expected);
});
