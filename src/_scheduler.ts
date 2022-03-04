export interface IScheduler {
    nextTick(): Promise<unknown>;
}