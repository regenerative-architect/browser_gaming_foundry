/**
 * Declarative mission graph. Event progress is credited only while prerequisites
 * are satisfied BEFORE the event; early actions cannot bypass ordering.
 */
export const QUESTS = Object.freeze([
  {id:'clear_first',stage:0,title:'Clear the watershed',requires:[],needs:{clean:2}},
  {id:'root_first',stage:0,title:'Root two native sprouts',requires:['clear_first'],needs:{plant:2}},
  {id:'clear_middle',stage:1,title:'Remove upstream waste',requires:['root_first'],needs:{clean:1}},
  {id:'water_path',stage:1,route:'water',title:'Revive the headwaters',requires:['clear_middle'],needs:{water:2}},
  {id:'canopy_path',stage:1,route:'canopy',title:'Build a green corridor',requires:['clear_middle'],needs:{plant:3}},
  {id:'clear_last',stage:2,title:'Protect the final meadow',requires:['water_path','canopy_path'],anyRequirement:true,needs:{clean:2}},
  {id:'legacy',stage:2,title:'Leave a living legacy',requires:['clear_last'],needs:{plant:2,water:1}}
]);
export const questById = id => QUESTS.find(q=>q.id===id);
export function relevantQuests(state) {
  return QUESTS.filter(q=>q.stage===state.stage && (!q.route || q.route===state.route));
}
export function prerequisitesMet(state,quest) {
  const done=state.completedQuests;
  return quest.anyRequirement ? quest.requires.some(id=>done.includes(id)) : quest.requires.every(id=>done.includes(id));
}
export function questIsDone(state,quest) {return state.completedQuests.includes(quest.id);}
export function stageComplete(state) {
  const qs=relevantQuests(state);
  return qs.length>0 && qs.every(q=>questIsDone(state,q));
}
export function applyQuestEvent(state,kind) {
  const earned=[];
  // Calculate eligible quests first; unlocking on this event cannot award the same event twice.
  const eligible=relevantQuests(state).filter(q=>!questIsDone(state,q) && prerequisitesMet(state,q));
  for (const q of eligible) {
    if (!Object.hasOwn(q.needs,kind)) continue;
    const progress=state.questProgress[q.id] ?? {};
    progress[kind]=Math.min(q.needs[kind],(progress[kind]||0)+1);
    state.questProgress[q.id]=progress;
    if (Object.entries(q.needs).every(([k,target])=>(progress[k]||0)>=target)) {
      state.completedQuests.push(q.id);
      earned.push(q.title);
    }
  }
  return earned;
}
