import { IScheduler } from "../_scheduler";

export class IdleScheduler implements IScheduler {
  async nextTick() {
    let callback = function (r) { setTimeout(r, 0); };
    if (window && typeof window.requestIdleCallback == "function") {
      callback = window.requestIdleCallback;
    }
    return new Promise((r, x) => {
      callback(r);
    })
  }
}