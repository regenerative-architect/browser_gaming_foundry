import { clamp,MAX_ENERGY,GRID,TOOLS } from '../core/constants.js';
import { tileAt } from '../world/generate.js';
import {applyQuestEvent} from '../progress/quests.js';

const impact = (eco, changes) => {
  for (const [metric,value] of Object.entries(changes)) eco[metric]=clamp(eco[metric]+value,0,100);
};
export function applyAction(state,requested=state.tool) {
  if (state.status!=='running') return {ok:false,message:'Start a run to act.'};
  if (!TOOLS.includes(requested)) return {ok:false,message:'Unknown field tool.'};
  if (state.energy<=0) return {ok:false,message:'Your field crew needs rest.'};
  const {x,y}=state.player;
  const tile=tileAt(state.world,x,y);
  if (x===GRID-1 && y===GRID-1) return {ok:false,message:'This is the passage gate. Complete your active quests to proceed.'};
  let kind, message;
  if (requested==='clean') {
    if (tile.kind!=='litter') return {ok:false,message:'Stand on a litter patch to clean it.'};
    tile.kind='meadow';state.supplies=clamp(state.supplies+2,0,20);
    impact(state.world.eco,{soil:6,water:3,biodiversity:2});
    kind='clean';message='Waste recovered: +2 supplies, +6 soil, +3 water, +2 biodiversity.';
  } else if (requested==='plant') {
    if (!['meadow','dry'].includes(tile.kind)) return {ok:false,message:'Plant on open soil or dry ground.'};
    if (state.supplies<2) return {ok:false,message:'Planting needs 2 supplies. Clean litter to recover supplies.'};
    state.supplies-=2;tile.kind='sprout';tile.watered=false;
    impact(state.world.eco,{soil:3,water:-2,biodiversity:6});
    kind='plant';message='Native sprout rooted: -2 supplies, +3 soil, -2 water, +6 biodiversity.';
  } else if (requested==='water') {
    if (tile.kind!=='sprout'||tile.watered) return {ok:false,message:'Water a dry sprout. Each sprout accepts one watering.'};
    if (state.canteen<1) return {ok:false,message:'Canteen empty. Refill at a blue spring.'};
    state.canteen--;tile.watered=true;
    impact(state.world.eco,{soil:1,water:8,biodiversity:4});
    kind='water';message='Sprout watered: -1 canteen, +1 soil, +8 water, +4 biodiversity.';
  } else if (requested==='refill') {
    if (tile.kind!=='spring') return {ok:false,message:'Find a blue spring to refill.'};
    if (tile.uses<1) return {ok:false,message:'This spring has reached its safe draw limit.'};
    if (state.canteen>=6) return {ok:false,message:'Canteen already full (6).'};
    tile.uses--;state.canteen=clamp(state.canteen+3,0,6);
    kind='refill';message=`Canteen refilled to ${state.canteen}/6. Spring has ${tile.uses} safe draws remaining.`;
  }
  state.energy=clamp(state.energy-1,0,MAX_ENERGY);
  state.actions++;
  // A finite, stylized drought penalty every 3 successful field actions.
  if (state.actions%3===0) impact(state.world.eco,{soil:-1,water:-1});
  const earned=applyQuestEvent(state,kind);
  return {ok:true,kind,message:message+(earned.length?' Quest complete: '+earned.join(', ')+'.':'')};
}
