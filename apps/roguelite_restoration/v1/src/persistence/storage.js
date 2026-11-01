import {APP_ID} from '../core/constants.js';
import {makeBackup,parseBackup} from './schema.js';
const DB_NAME='pocket-restoration-db';
const FALLBACK_KEY='pocket-restoration-v2-snapshot';

function openDatabase() {
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined') {reject(Error('IndexedDB unavailable'));return;}
    const request=indexedDB.open(DB_NAME,2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('slots')) db.createObjectStore('slots');
      if(!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Database open failed'));
    request.onblocked=()=>reject(Error('Close other tabs before upgrading the save database.'));
  });
}
function txn(db,mode,fn) {
  return new Promise((resolve,reject)=>{
    let transaction;
    try {transaction=db.transaction(['slots','preferences'],mode);}catch(err){reject(err);return;}
    const slots=transaction.objectStore('slots'),prefs=transaction.objectStore('preferences');
    let result;
    try {result=fn(slots,prefs,transaction);}catch(e){transaction.abort();reject(e);return;}
    transaction.oncomplete=()=>resolve(result);
    transaction.onerror=()=>reject(transaction.error||Error('Save transaction failed'));
    transaction.onabort=()=>reject(transaction.error||Error('Save transaction was aborted'));
  });
}
function readKey(db,store,key) {
  return new Promise((resolve,reject)=>{
    const t=db.transaction(store,'readonly');
    const r=t.objectStore(store).get(key);
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}
/**
 * Interface: init() => mode; load() => snapshot|null; save(snapshot) => Promise;
 * erase() => Promise. Writes are serialized and atomically commit slot + prefs.
 * No network APIs, usernames, cookies, or telemetry are used.
 */
export class SaveStore {
  constructor() {this.db=null;this.mode='memory';this.memory=null;this.queue=Promise.resolve();this.warning='';this.revision=0;}
  async init() {
    try {this.db=await openDatabase();this.mode='indexeddb';}
    catch (err) {
      this.warning=`IndexedDB not available (${err.message}).`;
      try {
        localStorage.setItem(`${APP_ID}-probe`,'yes');
        localStorage.removeItem(`${APP_ID}-probe`);
        this.mode='localstorage';
      } catch {this.mode='memory';}
    }
    return this.mode;
  }
  async load() {
    let value=null;
    if(this.mode==='indexeddb') value=await readKey(this.db,'slots','main');
    else if(this.mode==='localstorage') value=localStorage.getItem(FALLBACK_KEY);
    else value=this.memory;
    if(!value) return null;
    // The envelope revision is an optimistic concurrency token, not a user identifier.
    const stored=typeof value==='string'?JSON.parse(value):value;
    const envelope=stored?.backup && Number.isSafeInteger(stored.revision);
    this.revision=envelope?stored.revision:0;
    // Validate even data from internal storage; corrupted saves are not trusted.
    return parseBackup(JSON.stringify(envelope?stored.backup:stored));
  }
  async _write(backup) {
    const expected=this.revision, next=expected+1;
    const envelope={revision:next,backup};
    if(this.mode==='indexeddb') {
      await new Promise((resolve,reject)=>{
        const transaction=this.db.transaction(['slots','preferences'],'readwrite');
        const slots=transaction.objectStore('slots'),prefs=transaction.objectStore('preferences');
        let conflict=null;
        const request=slots.get('main');
        request.onsuccess=()=>{
          const current=request.result;
          const actual=current && Number.isSafeInteger(current.revision)?current.revision:0;
          if(actual!==expected){
            conflict=Error('Save conflict: another tab changed this slot. Export a backup, then reload before saving.');
            transaction.abort();return;
          }
          slots.put(envelope,'main');prefs.put(backup.settings,'settings');
        };
        transaction.oncomplete=resolve;
        transaction.onerror=()=>reject(conflict||transaction.error||Error('Write failed'));
        transaction.onabort=()=>reject(conflict||transaction.error||Error('Write aborted'));
      });
    } else if(this.mode==='localstorage') {
      const previous=localStorage.getItem(FALLBACK_KEY);
      const actual=previous ? (JSON.parse(previous).revision||0):0;
      if(actual!==expected)throw Error('Save conflict: another tab changed this slot. Export, then reload.');
      localStorage.setItem(FALLBACK_KEY,JSON.stringify(envelope));
    } else this.memory=JSON.stringify(envelope);
    this.revision=next;
    return backup;
  }
  save(state,settings) {
    const backup=makeBackup(state,settings);
    // Even if caller triggers rapid input + import, commits stay ordered.
    const next=this.queue.catch(()=>{}).then(()=>this._write(backup));
    this.queue=next;
    return next;
  }
  saveValidated(backup) {
    const canonical=parseBackup(JSON.stringify(backup));
    const next=this.queue.catch(()=>{}).then(()=>this._write(canonical));
    this.queue=next;
    return next;
  }
  async erase() {
    const next=this.queue.catch(()=>{}).then(async()=>{
      if(this.mode==='indexeddb') await txn(this.db,'readwrite',(slots,prefs)=>{slots.clear();prefs.clear();});
      else if(this.mode==='localstorage') localStorage.removeItem(FALLBACK_KEY);
      else this.memory=null;
    });
    this.queue=next;
    await next;this.revision=0;
    return next;
  }
}
