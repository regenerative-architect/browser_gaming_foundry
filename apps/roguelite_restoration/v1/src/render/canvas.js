import {GRID,clamp} from '../core/constants.js';

export class PerformanceScaler {
  constructor() {
    const device=typeof navigator==='undefined'?null:navigator;
    this.autoTier=(device?.deviceMemory && device.deviceMemory<=2)||(device?.hardwareConcurrency && device.hardwareConcurrency<=2)?'low':'medium';
    this.frames=[];this.last=0;this.sinceChange=0;this.fps=60;}
  observe(now) {
    if(this.last) {
      const duration=now-this.last;
      if(duration>0&&duration<250) {
        this.frames.push(duration);
        if(this.frames.length>90) this.frames.shift();
        if(this.frames.length>=60) {
          const average=this.frames.reduce((a,b)=>a+b,0)/this.frames.length;
          this.fps=Math.round(1000/average);
          if(now-this.sinceChange>8000 && average>30 && this.autoTier!=='low') {
            this.autoTier='low';this.sinceChange=now;
          } else if(now-this.sinceChange>15000 && average<18 && this.autoTier==='low') {
            this.autoTier='medium';this.sinceChange=now;
          }
        }
      }
    }
    this.last=now;
  }
  tier(settings) {return settings.quality==='auto'?this.autoTier:settings.quality;}
  dpr(settings,side=450) {
    const t=this.tier(settings);
    // Approximate Canvas color-buffer budget; actual browser memory use can be higher.
    const pixelBudget=t==='low'?640000:t==='high'?1800000:1100000;
    return Math.max(.5,Math.min((typeof window!=='undefined'?window.devicePixelRatio:1)||1,t==='low'?1:t==='high'?2:1.5,Math.sqrt(pixelBudget)/Math.max(1,side)));
  }
}

const palettes={
  meadow:['#3d7650','#507e51'],dry:['#998a54','#ad995e'],litter:['#715953','#785f4f'],spring:['#377d91','#368b9f'],rock:['#53635d','#61736a'],grove:['#306a44','#3d754b'],sprout:['#548650','#5e9255']
};
function circle(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
export class HabitatCanvas {
  constructor(canvas,scaler) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    this.scaler=scaler;this.size=450;this.pixelRatio=0;
  }
  draw(state,settings,now,reduced) {
    if(!this.ctx) return false;
    const cssSize=Math.max(160,Math.round(this.canvas.getBoundingClientRect().width||450));
    const ratio=this.scaler.dpr(settings,cssSize);
    const pixels=Math.floor(cssSize*ratio);
    if(this.canvas.width!==pixels||this.canvas.height!==pixels) {
      this.canvas.width=pixels;this.canvas.height=pixels;
    }
    const ctx=this.ctx,cell=pixels/GRID;
    ctx.clearRect(0,0,pixels,pixels);
    ctx.fillStyle='#204730';ctx.fillRect(0,0,pixels,pixels);
    if(!state.world) {
      for(let y=0;y<GRID;y++) for(let x=0;x<GRID;x++){
        ctx.fillStyle=(x+y)%2===0?'#2e563a':'#365c40';
        ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);
      }
      ctx.font=`bold ${Math.round(cell*.46)}px system-ui`;
      ctx.textAlign='center';ctx.fillStyle='#b9e899';
      ctx.fillText('✦',pixels/2,pixels/2+cell*.12);return true;
    }
    const low=this.scaler.tier(settings)==='low';
    for(let i=0;i<state.world.tiles.length;i++) {
      const t=state.world.tiles[i],x=i%GRID,y=Math.floor(i/GRID);
      const px=x*cell,py=y*cell,m=cell*.5;
      ctx.fillStyle=palettes[t.kind][(x+y)%2];ctx.fillRect(px+.4,py+.4,cell-.8,cell-.8);
      const cx=px+m,cy=py+m;
      if(t.kind==='dry'){
        ctx.strokeStyle='#63583b';ctx.lineWidth=Math.max(1,cell*.04);
        ctx.beginPath();ctx.moveTo(px+cell*.18,cy);ctx.lineTo(cx,cy+cell*.15);ctx.lineTo(px+cell*.7,cy-cell*.11);ctx.stroke();
      } else if(t.kind==='litter') {
        ctx.fillStyle='#d5c0a2';ctx.fillRect(cx-cell*.22,cy-cell*.13,cell*.3,cell*.23);
        ctx.fillStyle='#7bc2ca';ctx.fillRect(cx,cy-cell*.09,cell*.17,cell*.29);
        ctx.strokeStyle='#263b3a';ctx.lineWidth=1;ctx.strokeRect(cx,cy-cell*.09,cell*.17,cell*.29);
      } else if(t.kind==='rock') {
        ctx.fillStyle='#a1aea6';ctx.beginPath();ctx.moveTo(cx-cell*.28,cy+cell*.19);ctx.lineTo(cx-cell*.17,cy-cell*.24);ctx.lineTo(cx+cell*.13,cy-cell*.29);ctx.lineTo(cx+cell*.3,cy+cell*.19);ctx.closePath();ctx.fill();
      } else if(t.kind==='spring') {
        circle(ctx,cx,cy,cell*.31,'#9be0df');circle(ctx,cx,cy,cell*.22,'#2a809a');
        if(t.uses===0){ctx.strokeStyle='#365c56';ctx.lineWidth=cell*.09;ctx.beginPath();ctx.moveTo(cx-cell*.2,cy+cell*.2);ctx.lineTo(cx+cell*.2,cy-cell*.2);ctx.stroke();}
        else if(!low){circle(ctx,cx-cell*.09,cy-cell*.07,cell*.06,'#dbfaf2');}
      } else if(t.kind==='grove'||t.kind==='sprout') {
        const large=t.kind==='grove';
        ctx.fillStyle='#6e5035';ctx.fillRect(cx-cell*.055,cy-cell*(large?.03:-.03),cell*.11,cell*(large?.36:.23));
        const r=cell*(large?.31:.18);
        const sway=!reduced&&!low?Math.sin(now/1100+i)*cell*.018:0;
        circle(ctx,cx+sway,cy-cell*(large?.14:.06),r,large?'#9bd179':'#b2e287');
        if(t.watered) circle(ctx,cx+cell*.2,cy+cell*.21,cell*.09,'#98e1e6');
      } else if(!low && (i*7)%17===0){circle(ctx,cx+cell*.22,cy+cell*.21,cell*.045,'#88aa61');}
      if(!low){ctx.strokeStyle='#152c2240';ctx.lineWidth=Math.max(1,cell*.018);ctx.strokeRect(px+.5,py+.5,cell-1,cell-1);}
    }
    // Permanent golden passage marker, distinct from collectible tiles.
    const gx=GRID-1,gy=GRID-1;
    ctx.fillStyle='#ffdb8f';ctx.strokeStyle='#483e22';ctx.lineWidth=cell*.07;
    ctx.beginPath();ctx.moveTo((gx+.5)*cell,(gy+.14)*cell);ctx.lineTo((gx+.85)*cell,(gy+.5)*cell);ctx.lineTo((gx+.5)*cell,(gy+.86)*cell);ctx.lineTo((gx+.15)*cell,(gy+.5)*cell);ctx.closePath();ctx.fill();ctx.stroke();
    // Player with white outline to remain visible to color-blind users.
    const centerX=(state.player.x+.5)*cell,centerY=(state.player.y+.5)*cell;
    circle(ctx,centerX,centerY,cell*.31,'#102c22');circle(ctx,centerX,centerY,cell*.26,'#fff6d8');
    circle(ctx,centerX,centerY,cell*.18,'#eaa45d');
    ctx.fillStyle='#20472f';ctx.fillRect(centerX-cell*.12,centerY-cell*.02,cell*.22,cell*.2);
    circle(ctx,centerX+cell*.16,centerY+cell*.1,cell*.06,'#c9ee9a');
    ctx.lineWidth=Math.max(1,cell*.025);ctx.strokeStyle='#fff';ctx.strokeRect((state.player.x+.07)*cell,(state.player.y+.07)*cell,cell*.86,cell*.86);
    return true;
  }
}
