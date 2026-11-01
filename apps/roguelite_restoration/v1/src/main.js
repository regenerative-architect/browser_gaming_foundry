import {initialState,startRun,runCommand,chooseRoute,purchaseUpgrade,upgradePrice,defaultSettings,scoreEco} from './core/game.js';
import {GRID,MAX_FILE_BYTES} from './core/constants.js';
import {relevantQuests,prerequisitesMet,questIsDone,stageComplete} from './progress/quests.js';
import {tileAt} from './world/generate.js';
import {randomSeed} from './world/seed.js';
import {SaveStore} from './persistence/storage.js';
import {makeBackup,parseBackup} from './persistence/schema.js';
import {HabitatCanvas,PerformanceScaler} from './render/canvas.js';
import {installInput} from './ui/input.js';
import {GameEngine} from './core/engine.js';

const $=id=>document.getElementById(id);
const store=new SaveStore();
let state=initialState(),settings=defaultSettings(),saveTimer=null,lastAnnounced='',lastDraw=0,changeSeq=0;
const canvas=new HabitatCanvas($('board'),new PerformanceScaler());
const systemReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
const reduced=()=>settings.motion==='on'||(settings.motion==='system'&&Boolean(systemReduced?.matches));
let lastWorld=null,routePending=false,installingUpdate=false;

function announce(text) {
  if(text!==lastAnnounced){$('announcement').textContent=text;lastAnnounced=text;}
}
function setSaveStatus(text,isError=false) {
  $('save-indicator').textContent=text;
  $('save-indicator').style.color=isError?'#ffb9a3':'';
}
function setupStateInUI() {
  const working=state.status==='running';
  $('sector-label').textContent=state.status==='ready'?'BEFORE THE TRAIL':state.status==='victory'?'TRAIL RESTORED':state.status==='failed'?'CREW RESTING':`SECTOR ${state.stage+1} / 3 · ${state.route||'DISCOVERY'}`;
  $('seed-input').value=state.seed||$('seed-input').value||'living-earth-01';
  const here=state.world?tileAt(state.world,state.player.x,state.player.y):null;
  $('location-readout').textContent=here?`🧭 ${state.player.x+1},${state.player.y+1} · ${here.kind.toUpperCase()}`:'🧭 Expedition staging area';
  $('tile-description').textContent=here?`Column ${state.player.x+1}, row ${state.player.y+1}: ${here.kind}${here.kind==='spring'?`, ${here.uses} safe draws left`:''}${here.kind==='sprout'?(here.watered?', watered':', needs water'):''}. The gold passage is at column 9, row 9.`:'The starting crew enters at column 1, row 1. The golden passage is at column 9, row 9.';
  for(const key of ['soil','water','biodiversity']) {
    const value=state.world?Math.round(state.world.eco[key]):0;
    $(`${key}-meter`).value=value;
    $(`${key}-value`).textContent=state.world?`${value}%`:'—';
  }
  $('energy-value').textContent=state.world?`${state.energy}/15`:'—';
  $('supplies-value').textContent=state.world?state.supplies:'—';
  $('canteen-value').textContent=state.world?`${state.canteen}/6`:'—';
  $('turn-value').textContent=state.turn;
  $('action-button').disabled=!working;
  $('action-button').firstChild.textContent=here&&state.player.x===8&&state.player.y===8?'ENTER GATE ':'RESTORE ';
  for(const btn of document.querySelectorAll('[data-tool]')){
    const active=btn.dataset.tool===state.tool;
    btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));btn.disabled=!working;
  }
  for(const btn of document.querySelectorAll('[data-move]'))btn.disabled=!working;
  $('runs-value').textContent=state.meta.runs;
  $('victories-value').textContent=state.meta.victories;
  $('best-value').textContent=`${state.meta.bestScore}/100`;
  $('knowledge-value').textContent=state.meta.knowledge;
  const price=upgradePrice(state.meta);
  $('upgrade-label').textContent=price===null?'Crew training mastered (tier 3).':`Tier ${state.meta.toolLevel}/3. Spend ${price} knowledge for +1 supplies at each sector start.`;
  $('upgrade-button').disabled=working||price===null||state.meta.knowledge<price;
  $('upgrade-button').textContent=price===null?'Fully trained':`Train crew · ${price} knowledge`;
  const questList=$('quest-list');questList.replaceChildren();
  if(!state.world){const li=document.createElement('li');li.textContent='Begin a trail to reveal linked objectives.';questList.append(li);}
  else {
    for(const quest of relevantQuests(state)){
      const done=questIsDone(state,quest),active=!done&&prerequisitesMet(state,quest);
      const li=document.createElement('li');li.className=done?'done':active?'active':'locked';
      const heading=document.createElement('strong');heading.textContent=(done?'✓ ':active?'◉ ':'🔒 ')+quest.title;
      const description=document.createElement('small');
      if(done)description.textContent='Complete';
      else if(!active)description.textContent='Prerequisite locked';
      else description.textContent=Object.entries(quest.needs).map(([kind,total])=>`${kind}: ${state.questProgress[quest.id]?.[kind]||0}/${total}`).join(' · ');
      li.append(heading,description);questList.append(li);
    }
  }
  routePending=working&&state.stage===0&&!state.route&&state.player.x===8&&state.player.y===8&&stageComplete(state);
  $('route-button').hidden=!routePending;
  announce(state.notice);
  renderFallback();
}
function renderFallback() {
  if(canvas.ctx||!state.world)return;
  const grid=$('html-board');grid.hidden=false;
  if(lastWorld!==state.world){grid.replaceChildren();lastWorld=state.world;}
  if(grid.childElementCount!==GRID*GRID){grid.replaceChildren();for(let i=0;i<GRID*GRID;i++){const b=document.createElement('button');b.type='button';b.dataset.tile=i;grid.append(b);}}
  const colors={meadow:'#507e51',dry:'#ad995e',litter:'#785f4f',spring:'#368b9f',rock:'#61736a',grove:'#3d754b',sprout:'#5e9255'};
  const symbols={meadow:'·',dry:'≋',litter:'▣',spring:'◉',rock:'▲',grove:'♣',sprout:'♠'};
  [...grid.children].forEach((button,i)=>{
    const t=state.world.tiles[i],x=i%GRID,y=Math.floor(i/GRID),current=x===state.player.x&&y===state.player.y;
    button.style.background=colors[t.kind];button.textContent=current?'◎':x===8&&y===8?'★':symbols[t.kind];
    button.setAttribute('aria-label',`Column ${x+1} row ${y+1}: ${t.kind}${current?', player here':''}`);
  });
}
function markChanged() {setupStateInUI();scheduleSave();}
function processCommand(command) {
  const result=runCommand(state,command);
  if(result.changed)markChanged();
  else if(command.type==='act'||command.type==='move')setupStateInUI();
  if(result.transition==='choose')openRoute();
}
function scheduleSave() {
  changeSeq++;
  clearTimeout(saveTimer);setSaveStatus('Unsaved changes');
  saveTimer=setTimeout(()=>{void saveNow();},350);
}
async function saveNow() {
  clearTimeout(saveTimer);saveTimer=null;
  const savingSeq=changeSeq;
  try {await store.save(state,settings);if(savingSeq===changeSeq)setSaveStatus(store.mode==='memory'?'Session only · export backup':`Saved locally · ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);}
  catch(error) {setSaveStatus('Save failed · export backup',true);announce(`Local write failed (${error.name||'storage error'}). Export a JSON backup now.`);}
}
function openRoute() {
  if(!routePending)return;
  const dialog=$('route-dialog');if(dialog.open)return;
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
}
function closeRoute() {
  const dialog=$('route-dialog');if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
}
function beginRun() {
  const seed=$('seed-input').value.trim();
  if(state.status==='running'&&!confirm('Replace this unfinished trail? Field mastery stays, but this run cannot be resumed.'))return;
  try {state=startRun(state.meta,seed);lastWorld=null;markChanged();$('board').focus({preventScroll:true});}
  catch(error){announce(error.message);$('seed-input').focus();}
}
function exportBackup() {
  let backup;
  try{backup=makeBackup(state,settings);}catch(error){announce(`Cannot export: ${error.message}`);return;}
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download=`pocket_restoration_${state.seed||'progress'}_${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  announce('Backup created. Keep the downloaded JSON file somewhere safe.');
}
async function importBackup(file) {
  if(!file)return;
  try {
    if(file.size>MAX_FILE_BYTES)throw Error('File exceeds 1 MiB.');
    const text=await file.text();const incoming=parseBackup(text);
    const s=incoming.state;
    if(!confirm(`Import validated ${s.seed||'unstarted'} backup (${s.meta.runs} trails, ${s.meta.knowledge} knowledge)? This replaces the current local save. Export it first if needed.`))return;
    await store.saveValidated(incoming); // Atomic commit before changing live state.
    state=s;settings=incoming.settings;lastWorld=null;
    applySettingsToControls();setupStateInUI();setSaveStatus('Imported & saved locally');
  }catch(error){announce(`Import rejected. Existing progress unchanged. ${error.message}`);}
  finally{$('import-file').value='';}
}
function applySettingsToControls() {
  $('motion-setting').value=settings.motion;
  $('quality-setting').value=settings.quality;
  $('large-controls-setting').checked=settings.largeControls;
  document.body.classList.toggle('compact-controls',!settings.largeControls);
}
function bindUi(engine) {
  $('start-button').addEventListener('click',beginRun);
  $('roll-seed').addEventListener('click',()=>{$('seed-input').value=randomSeed();announce('New seed generated. Start a trail when ready.');});
  $('action-button').addEventListener('click',()=>engine.enqueue({type:'act'}));
  for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>engine.enqueue({type:'tool',tool:button.dataset.tool}));
  for(const button of document.querySelectorAll('[data-route]'))button.addEventListener('click',()=>{
    const result=chooseRoute(state,button.dataset.route);
    if(result){closeRoute();markChanged();}
  });
  $('route-button').addEventListener('click',openRoute);
  $('route-later').addEventListener('click',closeRoute);
  $('route-dialog').addEventListener('cancel',event=>{event.preventDefault();closeRoute();});
  $('upgrade-button').addEventListener('click',()=>{const result=purchaseUpgrade(state);announce(result.message);if(result.ok)markChanged();});
  $('save-button').addEventListener('click',()=>void saveNow());
  $('export-button').addEventListener('click',exportBackup);
  $('import-file').addEventListener('change',event=>void importBackup(event.target.files?.[0]));
  $('import-label').addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();$('import-file').click();}
  });
  $('erase-button').addEventListener('click',async()=>{
    if(!confirm('Erase all local progress, field mastery and preferences? This cannot be undone without a JSON backup.'))return;
    try{await store.erase();state=initialState();settings=defaultSettings();lastWorld=null;applySettingsToControls();setupStateInUI();setSaveStatus('All local game data erased');announce('Local progress erased. You can start a new trail.');}
    catch(error){announce(`Erase failed: ${error.message}`);}
  });
  for(const [id,field] of [['motion-setting','motion'],['quality-setting','quality']]) {
    $(id).addEventListener('change',e=>{settings[field]=e.target.value;markChanged();});
  }
  $('large-controls-setting').addEventListener('change',e=>{settings.largeControls=e.target.checked;applySettingsToControls();markChanged();});
  $('html-board').addEventListener('click',e=>{
    const i=Number(e.target.closest('[data-tile]')?.dataset.tile);
    if(!Number.isInteger(i)||i<0||i>=81||!state.world)return;
    const x=i%GRID,y=Math.floor(i/GRID),dx=x-state.player.x,dy=y-state.player.y;
    if(dx===0&&dy===0)engine.enqueue({type:'act'});
    else if(Math.abs(dx)+Math.abs(dy)===1)engine.enqueue({type:'move',direction:dx===1?'right':dx===-1?'left':dy===1?'down':'up'});
    else announce('Select your tile to act, or an adjacent tile to move.');
  });
  installInput({board:$('board'),dispatch:c=>engine.enqueue(c),selectTool:tool=>engine.enqueue({type:'tool',tool})});
  window.addEventListener('pagehide',()=>{if(saveTimer){clearTimeout(saveTimer);void saveNow();}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&saveTimer)void saveNow();});
}
async function registerOfflineShell() {
  const secure=location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1';
  if(!('serviceWorker' in navigator)||!secure) return;
  try {
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&navigator.serviceWorker.controller) $('update-button').hidden=false;
      });
    });
    if(registration.waiting)$('update-button').hidden=false;
    $('update-button').addEventListener('click',()=>{
      installingUpdate=true;registration.waiting?.postMessage({type:'SKIP_WAITING'});
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(installingUpdate)location.reload();});
  }catch(error){console.warn('Offline install unavailable:',error);}
}
async function main() {
  try {
    await store.init();
    $('storage-mode').textContent=store.mode==='indexeddb'?'IndexedDB · local save slot · no account':store.mode==='localstorage'?'localStorage fallback · may be removed by browser privacy settings': 'Memory only · progress will not survive reload. Export before closing.';
    const loaded=await store.load();
    if(loaded){state=loaded.state;settings=loaded.settings;setSaveStatus('Local save restored');}
    else setSaveStatus(store.mode==='memory'?'Memory-only session':'No save yet');
  }catch(error){setSaveStatus('Save could not be loaded',true);announce(`Stored save could not be read: ${error.message}`);}
  applySettingsToControls();setupStateInUI();
  if(!canvas.ctx){$('board').hidden=true;$('html-board').hidden=false;}
  const engine=new GameEngine({handle:processCommand,render:time=>{
    canvas.scaler.observe(time);
    const quality=canvas.scaler.tier(settings);
    if(quality==='low'&&time-lastDraw<60)return;
    lastDraw=time;
    canvas.draw(state,settings,time,reduced());
  }});
  bindUi(engine);engine.start();
  void registerOfflineShell();
}
void main();
