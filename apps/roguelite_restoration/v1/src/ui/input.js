const keyDirs={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'};
export function installInput({board,dispatch,selectTool}) {
  const disposers=[];
  const keyboard=event=>{
    const tag=document.activeElement?.tagName;
    if(['INPUT','SELECT','TEXTAREA'].includes(tag)||document.querySelector('dialog[open]')) return;
    if(event.altKey||event.ctrlKey||event.metaKey) return;
    if(keyDirs[event.key]) {event.preventDefault();dispatch({type:'move',direction:keyDirs[event.key]});}
    else if(['1','2','3','4'].includes(event.key)) {event.preventDefault();selectTool(['clean','plant','water','refill'][Number(event.key)-1]);}
    else if([' ','e','E','Enter'].includes(event.key)) {
      // Preserve native keyboard activation for focused buttons and links.
      if(['BUTTON','A','SUMMARY'].includes(tag)) return;
      event.preventDefault();dispatch({type:'act'});
    }
  };
  window.addEventListener('keydown',keyboard);disposers.push(()=>window.removeEventListener('keydown',keyboard));
  for(const button of document.querySelectorAll('[data-move]')) {
    let hold=null,activePointer=null;
    const release=()=>{if(hold!==null)clearInterval(hold);hold=null;activePointer=null;};
    const onDown=event=>{
      if(event.button!==0||activePointer!==null)return;
      activePointer=event.pointerId;
      try{button.setPointerCapture(event.pointerId);}catch{}
      dispatch({type:'move',direction:button.dataset.move});
      hold=setInterval(()=>dispatch({type:'move',direction:button.dataset.move}),185);
      event.preventDefault();
    };
    button.addEventListener('pointerdown',onDown);
    button.addEventListener('pointerup',release);
    button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',release);
    disposers.push(()=>{release();button.removeEventListener('pointerdown',onDown);button.removeEventListener('pointerup',release);button.removeEventListener('pointercancel',release);button.removeEventListener('lostpointercapture',release);});
    // Buttons also work via keyboard .click(), without double-triggering pointer input.
    const onClick=e=>{if(e.detail===0)dispatch({type:'move',direction:button.dataset.move});};
    button.addEventListener('click',onClick);disposers.push(()=>button.removeEventListener('click',onClick));
  }
  let start=null;
  const down=e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY,pointerId:e.pointerId};try{board.setPointerCapture(e.pointerId);}catch{}};
  const up=e=>{
    if(!start||e.pointerId!==start.pointerId)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;
    if(Math.hypot(dx,dy)<25) return;
    dispatch({type:'move',direction:Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')});
  };
  board.addEventListener('pointerdown',down);
  board.addEventListener('pointerup',up);
  board.addEventListener('pointercancel',()=>{start=null;});
  window.addEventListener('blur',()=>{start=null;});
  return ()=>{for(const fn of disposers)fn();};
}
