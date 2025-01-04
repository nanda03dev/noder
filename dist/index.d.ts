interface NoderPoolConfig {
    workerCount: number;
}
export declare class NoderPool {
    private readonly worker_max_count;
    private readonly worker_min_count;
    private last_selected_worker_index;
    private job_count;
    private completed_job_count;
    private completed_worker_count;
    private force_stop;
    private workers;
    private config;
    private results;
    private eventEmitter;
    constructor(config?: NoderPoolConfig);
    private spawnWorkers;
    private getWorker;
    private listenFromWorker;
    private checkIsJobCompleted;
    private checkIsWorkerCompleted;
    private sendWorkCompleteEvent;
    private sendWorkStopEvent;
    private checkAndTerminateAllWorkers;
    private terminateAllWorkers;
    add(fn: (...args: any[]) => any, ...params: unknown[]): void;
    result(): Promise<any[]>;
    stop(): void;
}
export declare const noder: (fn: (...args: any[]) => any, ...params: unknown[]) => Promise<any>;
export {};
