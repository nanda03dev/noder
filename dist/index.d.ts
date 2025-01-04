interface NoderPoolConfig {
    workerCount: number;
    autoTerminate?: boolean;
}
export declare class NoderPool {
    private readonly MAX_WORKER_COUNT;
    private readonly MIN_WORKER_COUNT;
    private lastWorkerIndex;
    private totalAssignedJobs;
    private totalCompletedJobs;
    private totalCompletedWorkers;
    private areWorkersTerminated;
    private forceStop;
    private config;
    private workers;
    private results;
    private eventEmitter;
    constructor(config?: NoderPoolConfig);
    private initializeWorkers;
    private getNextWorker;
    private setupWorkerListeners;
    private areAllJobsCompleted;
    private areAllWorkersCompleted;
    private notifyWorkersIfJobsComplete;
    private notifyWorkersToStop;
    private terminateWorkersIfAllComplete;
    private terminateAllWorkers;
    private canAutoTerminate;
    private resetPoolState;
    private clearWorkerPool;
    private clearResults;
    add(fn: (...args: any[]) => any, ...params: unknown[]): void | Error;
    result(): Promise<any[]>;
    stop(): void;
    terminate(): Promise<void>;
}
export declare const noder: (fn: (...args: any[]) => any, ...params: unknown[]) => Promise<any>;
export {};
