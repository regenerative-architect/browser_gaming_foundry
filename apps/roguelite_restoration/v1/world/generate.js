import { GRID } from '../core/constants.js';
import { rngFromSeed, shuffled } from './seed.js';

export const cellIndex = (x,y) => y * GRID + x;
export const entry = {x:0,y:0};
export const exit = {x:GRID-1,y:GRID-1};
export const inBounds = (x,y) => x >= 0 && y >= 0 && x < GRID && y < GRID;
export const tileAt = (world,x,y) => world.tiles[cellIndex(x,y)];

export function reachability(world) {
  const seen = new Set([0]);
  const queue = [0];
  for (let i=0;i<queue.length;i++) {
    const at=queue[i], x=at%GRID, y=Math.floor(at/GRID);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx=x+dx,ny=y+dy;
      if (!inBounds(nx,ny)) continue;
      const ni=cellIndex(nx,ny);
      if (world.tiles[ni].kind !== 'rock' && !seen.has(ni)) {seen.add(ni);queue.push(ni);}
    }
  }
  return seen;
}

/** Exact same seed, room index and algorithm version always produce the same room. */
export function generateRoom(seed,stage) {
  const rng=rngFromSeed(`PRR-world-v1:${seed}:${stage}`);
  const reserved = new Set([cellIndex(0,0),cellIndex(GRID-1,GRID-1)]);
  const positions=Array.from({length:GRID*GRID},(_,i)=>i).filter(i=>!reserved.has(i));
  let tiles;
  // Reject the rare rock placement that strands essential resources.
  for (let attempt=0;attempt<50;attempt++) {
    tiles=Array.from({length:GRID*GRID},()=>({kind:'meadow',watered:false,uses:0}));
    const p=shuffled(positions,rng);
    let offset=0;
    for(const i of p.slice(offset,offset+9)) tiles[i].kind='rock'; offset+=9;
    for(const i of p.slice(offset,offset+6)) tiles[i].kind='litter'; offset+=6;
    for(const i of p.slice(offset,offset+20)) tiles[i].kind='dry'; offset+=20;
    for(const i of p.slice(offset,offset+7)) tiles[i].kind='grove'; offset+=7;
    for(const i of p.slice(offset,offset+2)) {tiles[i].kind='spring';tiles[i].uses=2;} offset+=2;
    const candidate={tiles};
    const reachable=reachability(candidate);
    const essential=tiles.every((t,i)=> t.kind==='rock' || reachable.has(i));
    if (essential && reachable.has(cellIndex(exit.x,exit.y))) break;
    if (attempt===49) { // Defensive full-connectivity fallback with no obstacles.
      for (const t of tiles) if(t.kind==='rock') t.kind='meadow';
    }
  }
  return {
    version:1,stage,tiles,
    eco:{soil:24+Math.floor(rng()*12),water:22+Math.floor(rng()*14),biodiversity:22+Math.floor(rng()*12)}
  };
}
