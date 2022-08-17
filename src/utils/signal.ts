export class Signal {
  private _sub: (() => void)[] = [];

  async wait() {
    return new Promise<void>(r => {
      let cb = () => {
        this._sub.splice(this._sub.indexOf(cb), 1);
        r();
      }
      this._sub.push(cb);
    })
  }
  signal() {
    for (let sub of this._sub) {
      sub();
    }
  }
}


/** concurrent gate */
export class Gate {
  private _queue: (() => void)[] = [];

  constructor(private _count: number) {
  }

  async wait() {
    if (this._count > 0) {
      --this._count;
      return Promise.resolve();
    }

    return new Promise<void>(r => {
      let cb = () => {
        this._queue.splice(this._queue.indexOf(cb), 1);
        --this._count;
        r();
      }
      this._queue.push(cb);
    })
  }

  increment() {
    ++this._count;
    this.clearQueue()
  }

  setCount(count: number) {
    this._count = count;

    this.clearQueue();
  }

  private clearQueue() {
    while (this._count > 0 && this._queue.length > 0) {
      (this._queue.shift())();
    }
  }
}



export class BlockingQueue<T> {
  private _pushers: (() => T)[] = [];
  private _pullers: ((t: T) => void)[] = [];

  constructor() { }

  async push(value: T) {
    return new Promise<void>(r => {
      this._pushers.unshift(() => { r(); return value; });
      this.dequeue();
    })
  }

  async pull() {
    return new Promise<T>(r => {
      this._pullers.unshift((value:T) => { r(value) });
      this.dequeue();
    })  
  }

  dequeue(){
    while(this._pullers.length > 0 && this._pushers.length > 0){
      let puller = this._pullers.pop();
      let pusher = this._pushers.pop();
      puller(pusher());
    }    
  }
}