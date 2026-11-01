import {SAVE_VERSION,APP_ID,MAX_FILE_BYTES,DEFAULT_SETTINGS,EMPTY_META,GRID,TILE_KINDS,TOOLS} from '../core/constants.js';
import {QUESTS} from '../progress/quests.js';

const fail = message => {throw new Error('Invalid backup: '+message);};
function object(v,label) {
  if(!v || typeof v!=='object' || Array.isArray(v)) fail(label+' must be an object');
  return v;
}
function integer(n,label,min,max) {
  if(!Number.isSafeInteger(n)||n<min||n>max) fail(label+' is out of range');
  return n;
}
function inSet(v,label,options) {
  if(!options.includes(v)) fail(label+' has an unknown value');
  return v;
}
const boolean=(v,label)=>{if(typeof v!=='boolean') fail(label+' must be boolean');return v;};
const number=(n,label,min,max)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max) fail(label+' out of range');return n;};
export function validateSettings(input) {
  const s=object(input,'settings');
  return {
    motion:inSet(s.motion,'motion',['system','on','off']),
    quality:inSet(s.quality,'quality',['auto','low','medium','high']),
    largeControls:boolean(s.largeControls,'largeControls')
  };
}
export function validateMeta(input) {
  const m=object(input,'meta');
  const result={};
  for(const [key,max] of [['runs',1000000],['victories',1000000],['knowledge',100000],['toolLevel',3],['bestScore',100]]) {
    result[key]=integer(m[key],key,0,max);
  }
  if (result.victories>result.runs) fail('victories cannot exceed runs');
  return result;
}
export function validateState(input) {
  const s=object(input,'state');
  const status=inSet(s.status,'status',['ready','running','victory','failed']);
  const stage=integer(s.stage,'stage',0,2);
  if (typeof s.seed!=='string' || (status!=='ready' && !/^[a-zA-Z0-9 _-]{1,40}$/.test(s.seed)) || s.seed.length>40) fail('invalid seed');
  const player=object(s.player,'player');
  const px=integer(player.x,'player.x',0,GRID-1),py=integer(player.y,'player.y',0,GRID-1);
  const route=inSet(s.route,'route',[null,'water','canopy']);
  const tool=inSet(s.tool,'tool',TOOLS);
  const world=s.world===null?null:object(s.world,'world');
  let cleanWorld=null;
  if(world) {
    if(integer(world.version,'world version',1,1)!==1) fail('unrecognized world version');
    if(integer(world.stage,'world stage',0,2)!==stage) fail('world stage mismatch');
    if (!Array.isArray(world.tiles)||world.tiles.length!==GRID*GRID) fail('wrong world grid size');
    const tiles=world.tiles.map((tile,i)=>{
      object(tile,`tile ${i}`);
      return {
        kind:inSet(tile.kind,`tile ${i}`,TILE_KINDS),
        watered:boolean(tile.watered,`watered ${i}`),
        uses:integer(tile.uses,`spring uses ${i}`,0,2)
      };
    });
    if (tiles[py*GRID+px].kind==='rock') fail('player stands in a rock');
    const eco=object(world.eco,'ecology');
    cleanWorld={version:1,stage,tiles,eco:{
      soil:number(eco.soil,'soil',0,100),
      water:number(eco.water,'water',0,100),
      biodiversity:number(eco.biodiversity,'biodiversity',0,100)
    }};
  }
  if (status==='ready' && world!==null) fail('unstarted world should be null');
  if (status!=='ready' && !world) fail('running/finished world is missing');
  if (!Array.isArray(s.completedQuests)||s.completedQuests.length>QUESTS.length) fail('bad quest completion list');
  const ids=QUESTS.map(q=>q.id), completedQuests=[];
  for(const id of s.completedQuests) {
    if(typeof id!=='string'||!ids.includes(id)||completedQuests.includes(id)) fail('invalid quest ID');
    completedQuests.push(id);
  }
  const progress=object(s.questProgress,'quest progress');
  const questProgress={};
  for(const [id,counts] of Object.entries(progress)) {
    const quest=QUESTS.find(q=>q.id===id);
    if(!quest) fail('unknown quest progress ID');
    object(counts,'quest counters');
    questProgress[id]={};
    for(const [kind,value] of Object.entries(counts)) {
      if(!Object.hasOwn(quest.needs,kind)) fail('invalid quest counter kind');
      questProgress[id][kind]=integer(value,'quest counter',0,quest.needs[kind]);
    }
  }
  if (!Array.isArray(s.stageResults)||s.stageResults.length>3) fail('bad stage history');
  const stageResults=s.stageResults.map((v,i)=>{
    object(v,'stage result');object(v.eco,'stage ecology');
    return {stage:integer(v.stage,'result stage',0,2),score:integer(v.score,'result score',0,100),eco:{
      soil:number(v.eco.soil,'result soil',0,100),water:number(v.eco.water,'result water',0,100),biodiversity:number(v.eco.biodiversity,'result biodiversity',0,100)
    }};
  });
  const meta=validateMeta(s.meta);
  const notice=typeof s.notice==='string' ? s.notice.slice(0,400) : '';
  return {status,seed:s.seed,stage,route,player:{x:px,y:py},tool,
    energy:integer(s.energy,'energy',0,15),supplies:integer(s.supplies,'supplies',0,20),
    canteen:integer(s.canteen,'canteen',0,6),turn:integer(s.turn,'turns',0,1000000),
    actions:integer(s.actions,'actions',0,200),world:cleanWorld,
    completedQuests,questProgress,stageResults,meta,notice};
}
export function makeBackup(state,settings) {
  return {
    format:APP_ID,schemaVersion:SAVE_VERSION,exportedAt:new Date().toISOString(),
    state:validateState(state),settings:validateSettings(settings)
  };
}
/** Pure, non-mutating import and migration. Current live save stays untouched until caller commits. */
export function parseBackup(text) {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_FILE_BYTES) fail('file exceeds 1 MiB');
  let parsed;
  try {parsed=JSON.parse(text);} catch {fail('malformed JSON');}
  object(parsed,'root');
  if(parsed.format!==APP_ID) fail('unrecognized format');
  if(![1,SAVE_VERSION].includes(parsed.schemaVersion)) fail('unsupported schema version');
  // v1 lacked preferences. Upgrade to v2 by applying transparent defaults.
  const settings=parsed.schemaVersion===1 ? {...DEFAULT_SETTINGS} : parsed.settings;
  const result={format:APP_ID,schemaVersion:SAVE_VERSION,exportedAt:new Date().toISOString(),
    state:validateState(parsed.state),settings:validateSettings(settings)};
  return result;
}
