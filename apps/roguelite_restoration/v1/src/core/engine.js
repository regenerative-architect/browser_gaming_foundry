/** A stable fixed timestep with bounded input processing; simulation is turn-based.
 * Paused/background tabs never accumulate thousands of unplayed turns.
 */
export class GameEngine {
  constructor({handle,render}) {
    this.handle=handle;this.render=render;this.queue=[];this.last=0;this.accumulator=0;
    this.step=1000/30;this.running=false;this.raf=0;
    this.frame=this.frame.bind(this);
  }
  start() {if(this.running)return;this.running=true;this.raf=requestAnimationFrame(this.frame);}
  stop() {this.running=false;cancelAnimationFrame(this.raf);this.queue=[];}
  enqueue(command) {if(this.queue.length<20)this.queue.push(command);}
  frame(time) {
    if(!this.running)return;
    if(!this.last)this.last=time;
    this.accumulator+=Math.min(100,time-this.last);this.last=time;
    let iterations=0;
    while(this.accumulator>=this.step && iterations<3){
      this.accumulator-=this.step;iterations++;
      for(let i=0;i<8 && this.queue.length;i++) this.handle(this.queue.shift());
    }
    if(iterations===3)this.accumulator=0;
    this.render(time);
    this.raf=requestAnimationFrame(this.frame);
  }
}
