import {DEFAULT_SETTINGS,EMPTY_META,GRID,MAX_ENERGY,STAGES,DIRECTIONS,TOOLS,clamp} from './constants.js';
import {generateRoom,tileAt,inBounds} from '../world/generate.js';
import {applyAction} from '../gameplay/actions.js';
import {stageComplete} from '../progress/quests.js';

const copy = value => JSON.parse(JSON.stringify(value));
export const defaultSettings = () => copy(DEFAULT_SETTINGS);
export const defaultMeta = () => copy(EMPTY_META);
export function initialState(meta=defaultMeta()) {
  return {
    status:'ready',seed:'',stage:0,route:null,player:{x:0,y:0},tool:'clean',
    energy:MAX_ENERGY,supplies:3,canteen:3,turn:0,actions:0,
    world:null,completedQuests:[],questProgress:{},stageResults:[],
    meta:copy(meta),notice:'Enter a seed or generate one, then start a run.'
  };
}
export function startRun(meta,seed) {
  if (typeof seed!=='string' || !/^[a-zA-Z0-9 _-]{1,40}$/.test(seed)) throw Error('Seed needs 1–40 letters, numbers, spaces, _ or -.');
  const state=initialState(meta);
  Object.assign(state,{status:'running',seed,supplies:3+state.meta.toolLevel,world:generateRoom(seed,0),notice:'Trail opened. Clear litter before your first planting quest.'});
  state.meta.runs++;
  return state;
}
export function scoreEco(eco) {
  return Math.round((eco.soil+eco.water+eco.biodiversity)/3);
}
export function finalScore(state) {
  const scores=state.stageResults.map(s=>s.score);
  return scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
}
function settleStage(state) {
  state.stageResults.push({stage:state.stage,score:scoreEco(state.world.eco),eco:{...state.world.eco}});
}
function finishRun(state,won) {
  state.status=won?'victory':'failed';
  if (won) {
    state.meta.victories++;
    const score=finalScore(state);
    state.meta.bestScore=Math.max(state.meta.bestScore,score);
    const award=3+Math.floor(score/20);
    state.meta.knowledge=clamp(state.meta.knowledge+award,0,100000);
    state.notice=`The restoration trail thrives! Habitat score ${score}/100; +${award} knowledge. New seeds open new worlds.`;
  } else {
    const award=1+Math.floor(state.completedQuests.length/3);
    state.meta.knowledge=clamp(state.meta.knowledge+award,0,100000);
    state.notice=`The crew ran out of energy. +${award} field knowledge survives this attempt. Start a fresh run.`;
  }
}
export function attemptGate(state) {
  if (state.status!=='running') return false;
  if (state.player.x!==GRID-1||state.player.y!==GRID-1) {state.notice='Stand on the golden passage gate to advance.';return false;}
  if (!stageComplete(state)) {state.notice='The passage stays closed until the active quest graph is complete.';return false;}
  if (state.stage===0 && !state.route) {
    state.notice='Choose your route: headwaters or canopy.';
    return 'choose';
  }
  settleStage(state);
  if (state.stage===STAGES-1) {finishRun(state,true);return 'victory';}
  state.stage++;
  state.world=generateRoom(state.seed,state.stage);
  state.player={x:0,y:0};state.energy=MAX_ENERGY;
  state.supplies=3+state.meta.toolLevel;state.canteen=3;state.actions=0;
  state.notice=`Sector ${state.stage+1} reached. Resources reset; ecological legacy is recorded.`;
  return 'next';
}
export function chooseRoute(state,choice) {
  if (state.status!=='running'||state.stage!==0||!stageComplete(state)||state.route||state.player.x!==GRID-1||state.player.y!==GRID-1) return false;
  if (!['water','canopy'].includes(choice)) return false;
  state.route=choice;
  return attemptGate(state);
}
export function runCommand(state,command) {
  if (!command || typeof command!=='object') return {changed:false};
  if(command.type==='tool') {
    if (!TOOLS.includes(command.tool)) return {changed:false};
    state.tool=command.tool;state.notice=`Tool selected: ${command.tool}.`;
    return {changed:true};
  }
  if(state.status!=='running') return {changed:false};
  if (command.type==='move') {
    const delta=DIRECTIONS[command.direction];
    if (!delta) return {changed:false};
    const [dx,dy]=delta,nx=state.player.x+dx,ny=state.player.y+dy;
    if(!inBounds(nx,ny)){state.notice='The restoration zone ends here.';return {changed:false};}
    if(tileAt(state.world,nx,ny).kind==='rock'){state.notice='A boulder blocks that trail.';return {changed:false};}
    state.player={x:nx,y:ny};state.turn++;
    const tile=tileAt(state.world,nx,ny);
    state.notice= nx===GRID-1&&ny===GRID-1 ? 'Passage gate reached.' : `Moved to ${nx+1}, ${ny+1}: ${tile.kind}.`;
    const transition=nx===GRID-1&&ny===GRID-1?attemptGate(state):false;
    return {changed:true,transition};
  }
  if (command.type==='act') {
    if(state.player.x===GRID-1 && state.player.y===GRID-1) {
      return {changed:false,transition:attemptGate(state)};
    }
    const result=applyAction(state);
    state.notice=result.message;
    if(result.ok && state.energy===0 && !stageComplete(state)) finishRun(state,false);
    return {changed:result.ok,result};
  }
  return {changed:false};
}
export function purchaseUpgrade(state) {
  if(state.status==='running') return {ok:false,message:'Field training can only be purchased between runs.'};
  if(state.meta.toolLevel>=3) return {ok:false,message:'All three training tiers unlocked.'};
  const price=2+state.meta.toolLevel*3;
  if(state.meta.knowledge<price) return {ok:false,message:`Training needs ${price} knowledge.`};
  state.meta.knowledge-=price;
  state.meta.toolLevel++;
  state.notice=`Supply training tier ${state.meta.toolLevel} unlocked: +${state.meta.toolLevel} supplies at each new sector.`;
  return {ok:true,message:state.notice};
}
export function upgradePrice(meta) {return meta.toolLevel>=3?null:2+meta.toolLevel*3;}
