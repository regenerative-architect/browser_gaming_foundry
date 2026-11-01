import test from 'node:test';
import assert from 'node:assert/strict';
import {generateRoom,reachability,cellIndex} from '../src/world/generate.js';
import {GRID} from '../src/core/constants.js';
import {startRun,initialState,defaultMeta,runCommand,chooseRoute,finalScore,purchaseUpgrade} from '../src/core/game.js';
import {stageComplete,questIsDone,questById} from '../src/progress/quests.js';
import {applyAction} from '../src/gameplay/actions.js';

function pathTo(state,predicate) {
  const from=cellIndex(state.player.x,state.player.y);
  const queue=[from],previous=new Map([[from,null]]);
  let found=null;
  for(let i=0;i<queue.length;i++) {
    const at=queue[i],x=at%GRID,y=Math.floor(at/GRID);
    if(predicate(state.world.tiles[at],x,y)){found=at;break;}
    for(const [direction,dx,dy] of [['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]]){
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=GRID||ny>=GRID)continue;
      const index=cellIndex(nx,ny);
      if(!previous.has(index)&&state.world.tiles[index].kind!=='rock'){
        previous.set(index,{at,direction});queue.push(index);
      }
    }
  }
  assert.notEqual(found,null,'required tile must be reachable');
  const dirs=[];for(let i=found;i!==from;i=previous.get(i).at)dirs.unshift(previous.get(i).direction);
  for(const direction of dirs){const result=runCommand(state,{type:'move',direction});assert.equal(result.changed,true);}
  return found;
}
function doAt(state,tool,predicate) {
  pathTo(state,predicate);runCommand(state,{type:'tool',tool});
  const result=runCommand(state,{type:'act'});
  assert.equal(result.changed,true,result.result?.message);return result;
}
function enterGate(state){
  pathTo(state,(_,x,y)=>x===8&&y===8);
}

test('same seed and stage create identical reachable worlds',()=>{
  for(let n=0;n<120;n++){
    const seed='play-'+n;
    for(let stage=0;stage<3;stage++){
      const a=generateRoom(seed,stage),b=generateRoom(seed,stage);
      assert.deepEqual(a,b);
      const accessible=reachability(a);
      assert.equal(accessible.has(cellIndex(8,8)),true);
      assert.equal(a.tiles.every((tile,i)=>tile.kind==='rock'||accessible.has(i)),true);
      assert.ok(a.tiles.filter(t=>t.kind==='litter').length>=6);
    }
  }
  assert.notDeepEqual(generateRoom('A',0),generateRoom('B',0));
});

test('actions affect bounded ecology and cannot produce infinite resources',()=>{
  const state=startRun(defaultMeta(),'finite-test');
  doAt(state,'clean',t=>t.kind==='litter');
  const supplies=state.supplies,eco={...state.world.eco};
  const again=applyAction(state,'clean');
  assert.equal(again.ok,false);
  assert.equal(state.supplies,supplies);
  assert.deepEqual(state.world.eco,eco);
  doAt(state,'plant',t=>t.kind==='meadow'||t.kind==='dry');
  const twice=applyAction(state,'plant');assert.equal(twice.ok,false);
  doAt(state,'water',t=>t.kind==='sprout'&&!t.watered);
  assert.equal(applyAction(state,'water').ok,false);
  for(const score of Object.values(state.world.eco)) assert.ok(score>=0&&score<=100);
});

test('prerequisite locks prevent early quest completion',()=>{
  const s=startRun(defaultMeta(),'quest-order');
  doAt(s,'plant',t=>t.kind==='meadow'||t.kind==='dry');
  doAt(s,'clean',t=>t.kind==='litter');
  doAt(s,'plant',t=>t.kind==='meadow'||t.kind==='dry');
  assert.equal(questIsDone(s,questById('root_first')),false);
  doAt(s,'clean',t=>t.kind==='litter');
  assert.equal(questIsDone(s,questById('clear_first')),true);
  assert.equal(questIsDone(s,questById('root_first')),false);
  doAt(s,'clean',t=>t.kind==='litter'); // Additional supplies for actions performed before unlock.
  doAt(s,'plant',t=>t.kind==='meadow'||t.kind==='dry');
  doAt(s,'plant',t=>t.kind==='meadow'||t.kind==='dry');
  assert.equal(stageComplete(s),true);
});

for(const branch of ['water','canopy'])test(`three-sector ${branch} route can be completed`,()=>{
  const s=startRun(defaultMeta(),`winning-${branch}`);
  for(let i=0;i<2;i++)doAt(s,'clean',t=>t.kind==='litter');
  for(let i=0;i<2;i++)doAt(s,'plant',t=>['meadow','dry'].includes(t.kind)&&!(s.player.x===8&&s.player.y===8));
  assert.equal(stageComplete(s),true);
  assert.equal(chooseRoute(s,branch),false,'cannot bypass exit gate');
  enterGate(s);assert.equal(s.stage,0);
  assert.equal(chooseRoute(s,branch),'next');assert.equal(s.stage,1);
  doAt(s,'clean',t=>t.kind==='litter');
  if(branch==='water'){
    for(let i=0;i<2;i++)doAt(s,'plant',t=>['meadow','dry'].includes(t.kind));
    for(let i=0;i<2;i++)doAt(s,'water',t=>t.kind==='sprout'&&!t.watered);
  }else{
    doAt(s,'clean',t=>t.kind==='litter'); // The canopy route needs supplies from extra cleanup.
    for(let i=0;i<3;i++)doAt(s,'plant',t=>['meadow','dry'].includes(t.kind));
  }
  assert.equal(stageComplete(s),true);enterGate(s);assert.equal(s.stage,2);
  for(let i=0;i<2;i++)doAt(s,'clean',t=>t.kind==='litter');
  for(let i=0;i<2;i++)doAt(s,'plant',t=>['meadow','dry'].includes(t.kind));
  doAt(s,'water',t=>t.kind==='sprout'&&!t.watered);
  assert.equal(stageComplete(s),true);
  enterGate(s);
  assert.equal(s.status,'victory');assert.equal(s.meta.victories,1);
  assert.ok(finalScore(s)>0&&finalScore(s)<=100);
  assert.ok(s.meta.knowledge>=3);
});

test('metaprogression upgrades and new runs retain knowledge but reset room state',()=>{
  const meta=defaultMeta();meta.knowledge=8;
  let s=initialState(meta);
  assert.equal(purchaseUpgrade(s).ok,true);
  assert.equal(s.meta.toolLevel,1);
  const next=startRun(s.meta,'new-run');
  assert.equal(next.supplies,4);
  assert.equal(next.stageResults.length,0);
  assert.equal(next.completedQuests.length,0);
  assert.equal(next.meta.toolLevel,1);
});
