import { Worker } from 'worker_threads';
import * as path from 'path';
import { EventEmitter } from 'events';
import { ERROR_NO_ACTIVE_WORKERS, WORKER_COMPLETED, WORKER_ERROR, WORKER_RESULT } from './constants';

interface NoderPoolConfig {
    workerCount: number;
    autoTerminate?: boolean
}

export class NoderPool {
    private readonly MAX_WORKER_COUNT = 30;
    private readonly MIN_WORKER_COUNT = 2;

    // Index of the last selected worker
    private lastWorkerIndex = 0;

    // Number of jobs assigned to workers
    private totalAssignedJobs = 0;

    // Number of completed jobs
    private totalCompletedJobs = 0;

    // Number of workers that completed all their jobs
    private totalCompletedWorkers = 0;

    // Flag to indicate whether workers are terminated
    private areWorkersTerminated = false;

    // Flag for forcefully stopping workers
    private forceStop = false;

    // Worker pool configuration
    // workerCount - Number of workers initialized
    // autoTerminate - If true, workers will automatically terminate after completing assigned jobs.
    //                 If false, manual termination is required by calling the terminate() method.
    private config: NoderPoolConfig = { workerCount: this.MIN_WORKER_COUNT, autoTerminate: true };

    private workers: Worker[] = [];
    private results: any[] = [];
    private eventEmitter: EventEmitter = new EventEmitter();

    constructor(config: NoderPoolConfig = { workerCount: 2 }) {
        if (config.workerCount > this.MAX_WORKER_COUNT) {
            console.warn(
                `Warning: You have requested to create ${config.workerCount} workers, exceeding the recommended limit of ${this.MAX_WORKER_COUNT}.`
            );
            console.warn('Using too many workers may lead to performance or system resource issues.');
            console.warn('It is advised to reduce the worker count.');
        }
        this.config = config;
        this.initializeWorkers();
    }

    private initializeWorkers(): void {
        const workerScript = path.resolve(__dirname, 'worker.js');
        for (let i = 0; i < this.config.workerCount; i++) {
            const worker = new Worker(workerScript);
            this.workers.push(worker);
            this.setupWorkerListeners(worker);
        }
    }

    private getNextWorker(): Worker {
        const totalWorkers = this.workers.length;
        if (this.lastWorkerIndex >= totalWorkers) {
            this.lastWorkerIndex = 0;
        }
        this.lastWorkerIndex++;
        return this.workers[this.lastWorkerIndex - 1];
    }

    private setupWorkerListeners(worker: Worker): void {
        worker.on('message', (message) => {
            const { event, data } = message;
            switch (event) {
                case WORKER_RESULT:
                    this.results.push(data);
                    this.totalCompletedJobs++;
                    this.notifyWorkersIfJobsComplete();
                    break;
                case WORKER_ERROR:
                    this.totalCompletedJobs++;
                    this.notifyWorkersIfJobsComplete();
                    break;
                case WORKER_COMPLETED:
                    this.totalCompletedWorkers++;
                    this.terminateWorkersIfAllComplete();
                    this.eventEmitter.emit(WORKER_COMPLETED, data);
                    break;
            }
        });
    }

    // Check if all jobs are completed
    private areAllJobsCompleted(): boolean {
        return this.totalCompletedJobs >= this.totalAssignedJobs;
    }

    // Check if all workers have completed their jobs
    private areAllWorkersCompleted(): boolean {
        return this.totalCompletedWorkers >= this.workers.length;
    }

    // Notify workers when all jobs are completed
    private notifyWorkersIfJobsComplete(): void {
        if (this.areAllJobsCompleted()) {
            for (const worker of this.workers) {
                worker.postMessage({ isCompleted: true });
            }
        }
    }

    // Notify workers to stop execution
    private notifyWorkersToStop() {
        if (this.forceStop) {
            for (const worker of this.workers) {
                worker.postMessage({ isStopped: true });
            }
        }
    }

    // Terminate workers if autoTerminate is enabled or all workers are completed
    private terminateWorkersIfAllComplete() {
        if (this.canAutoTerminate() && this.areAllWorkersCompleted()) {
            this.terminateAllWorkers();
        }
    }

    // Terminate all workers and clean up
    private terminateAllWorkers() {
        for (const worker of this.workers) {
            worker.removeAllListeners();
            worker.terminate();
        }
        this.areWorkersTerminated = true;
        this.clearWorkerPool();
    }

    private canAutoTerminate(): boolean {
        return this.config?.autoTerminate == true;
    }

    // Reset the worker pool state
    private resetPoolState() {
        this.lastWorkerIndex = 0;
        this.totalAssignedJobs = 0;
        this.totalCompletedJobs = 0;
        this.totalCompletedWorkers = 0;
        this.forceStop = false;
    }

    private clearWorkerPool() {
        this.workers = [];
    }

    private clearResults() {
        this.results = [];
    }

    // Add a new job to the worker pool
    public add(fn: (...args: any[]) => any, ...params: unknown[]): void | Error {
        if (this.areWorkersTerminated) {
            return new Error(ERROR_NO_ACTIVE_WORKERS);
        }
        const worker = this.getNextWorker();
        const serializedFn = fn.toString();
        worker.postMessage({ fn: serializedFn, params });
        this.totalAssignedJobs++;
    }

    // Retrieve results as a Promise
    public result(): Promise<any[]> {
        return new Promise((resolve) => {
            if (this.totalAssignedJobs < 1) {
                this.terminateAllWorkers();
                return resolve(this.results);
            }

            const onWorkerCompleted = () => {
                if (this.areAllWorkersCompleted()) {
                    this.eventEmitter.removeListener(WORKER_COMPLETED, onWorkerCompleted);
                    const finalResults = [...this.results];
                    this.resetPoolState();
                    this.clearResults();
                    return resolve(finalResults);
                }
            };

            this.eventEmitter.on(WORKER_COMPLETED, onWorkerCompleted);
        });
    }

    // Stop all worker execution
    public stop() {
        this.forceStop = true;
        this.notifyWorkersToStop();
    }

    // Manually terminate all workers
    public async terminate() {
        await this.result()
        this.config.autoTerminate = true

        this.terminateAllWorkers()
        this.resetPoolState();
        this.clearWorkerPool();
        this.clearResults();
    }
}

export const noder = async function (
    fn: (...args: any[]) => any,
    ...params: unknown[]
): Promise<any> {
    return new Promise((res, _rej) => {
        try {
            const workerFile = path.resolve(__dirname, 'worker.js'); // Resolve path dynamically
            const worker = new Worker(workerFile);
            const serializedFn = fn.toString();

            worker.postMessage({ fn: serializedFn, params });

            worker.on('message', (message) => {
                const { event, data } = message;
                switch (event) {
                    case WORKER_RESULT:
                        res(data)
                        break;
                }
                worker.terminate();
            });

            worker.on('error', (error) => {
                worker.terminate();
                res(error);
            });

            worker.on('exit', (code) => {
                worker.terminate();
                res(new Error(`Worker stopped with exit code ${code}`));
            });
        } catch (error) {
            res(error);
        }
    });
};
