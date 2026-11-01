import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,startRun,defaultMeta,defaultSettings} from '../src/core/game.js';
import {makeBackup,parseBackup} from '../src/persistence/schema.js';

test('valid save round trips without mutation',()=>{
  const initial=startRun(defaultMeta(),'roundtrip-1');
  const backup=makeBackup(initial,defaultSettings());
  const json=JSON.stringify(backup);
  const parsed=parseBackup(json);
  assert.deepEqual(parsed.state,initial);
  assert.deepEqual(parsed.settings,defaultSettings());
  assert.equal(JSON.stringify(backup),json);
});

test('version one backup migrates missing settings to safe defaults',()=>{
  const backup=makeBackup(initialState(),defaultSettings());
  backup.schemaVersion=1;delete backup.settings;
  const restored=parseBackup(JSON.stringify(backup));
  assert.equal(restored.schemaVersion,2);
  assert.deepEqual(restored.settings,defaultSettings());
});

test('reject malformed, oversized, invalid fields, unknown quest and inconsistent saves',()=>{
  const base=makeBackup(startRun(defaultMeta(),'strict-seed'),defaultSettings());
  for(const invalid of [
    '{not-json',
    'a'.repeat(1024*1024+1),
    JSON.stringify({...base,format:'different-app'}),
    JSON.stringify({...base,schemaVersion:999}),
    JSON.stringify({...base,state:{...base.state,energy:9999}}),
    JSON.stringify({...base,state:{...base.state,completedQuests:['unknowable']}}),
    JSON.stringify({...base,state:{...base.state,world:{...base.state.world,tiles:[]}}}),
    JSON.stringify({...base,state:{...base.state,meta:{...base.state.meta,victories:2}}}),
    JSON.stringify({...base,settings:{...base.settings,quality:'javascript:evil'}})
  ]) assert.throws(()=>parseBackup(invalid));
});
