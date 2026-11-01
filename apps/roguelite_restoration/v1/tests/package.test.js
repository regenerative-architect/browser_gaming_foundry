import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('every offline shell asset exists and is relative to application root',()=>{
 const source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 const match=source.match(/const SHELL=\[([\s\S]*?)\];/);
 assert.ok(match,'service worker shell list exists');
 const names=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.ok(names.length>=15);
 for(const name of names){
  assert.ok(name.startsWith('./')&&!name.includes('..'),`safe relative asset: ${name}`);
  const destination=path.join(root,name.slice(2));
  assert.ok(fs.existsSync(destination),`missing precache asset: ${name}`);
 }
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
 assert.equal(manifest.display,'standalone');
 for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(root,icon.src)));
});
