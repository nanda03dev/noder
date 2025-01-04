"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.noder = exports.NoderPool = void 0;
const worker_threads_1 = require("worker_threads");
const path = __importStar(require("path"));
const events_1 = require("events");
const constants_1 = require("./constants");
class NoderPool {
    constructor(config = { workerCount: 2 }) {
        this.MAX_WORKER_COUNT = 30;
        this.MIN_WORKER_COUNT = 2;
        // Index of the last selected worker
        this.lastWorkerIndex = 0;
        // Number of jobs assigned to workers
        this.totalAssignedJobs = 0;
        // Number of completed jobs
        this.totalCompletedJobs = 0;
        // Number of workers that completed all their jobs
        this.totalCompletedWorkers = 0;
        // Flag to indicate whether workers are terminated
        this.areWorkersTerminated = false;
        // Flag for forcefully stopping workers
        this.forceStop = false;
        // Worker pool configuration
        // workerCount - Number of workers initialized
        // autoTerminate - If true, workers will automatically terminate after completing assigned jobs.
        //                 If false, manual termination is required by calling the terminate() method.
        this.config = { workerCount: this.MIN_WORKER_COUNT, autoTerminate: true };
        this.workers = [];
        this.results = [];
        this.eventEmitter = new events_1.EventEmitter();
        if (config.workerCount > this.MAX_WORKER_COUNT) {
            console.warn(`Warning: You have requested to create ${config.workerCount} workers, exceeding the recommended limit of ${this.MAX_WORKER_COUNT}.`);
            console.warn('Using too many workers may lead to performance or system resource issues.');
            console.warn('It is advised to reduce the worker count.');
        }
        this.config = config;
        this.initializeWorkers();
    }
    initializeWorkers() {
        const workerScript = path.resolve(__dirname, 'worker.js');
        for (let i = 0; i < this.config.workerCount; i++) {
            const worker = new worker_threads_1.Worker(workerScript);
            this.workers.push(worker);
            this.setupWorkerListeners(worker);
        }
    }
    getNextWorker() {
        const totalWorkers = this.workers.length;
        if (this.lastWorkerIndex >= totalWorkers) {
            this.lastWorkerIndex = 0;
        }
        this.lastWorkerIndex++;
        return this.workers[this.lastWorkerIndex - 1];
    }
    setupWorkerListeners(worker) {
        worker.on('message', (message) => {
            const { event, data } = message;
            switch (event) {
                case constants_1.WORKER_RESULT:
                    this.results.push(data);
                    this.totalCompletedJobs++;
                    this.notifyWorkersIfJobsComplete();
                    break;
                case constants_1.WORKER_ERROR:
                    this.totalCompletedJobs++;
                    this.notifyWorkersIfJobsComplete();
                    break;
                case constants_1.WORKER_COMPLETED:
                    this.totalCompletedWorkers++;
                    this.terminateWorkersIfAllComplete();
                    this.eventEmitter.emit(constants_1.WORKER_COMPLETED, data);
                    break;
            }
        });
    }
    // Check if all jobs are completed
    areAllJobsCompleted() {
        return this.totalCompletedJobs >= this.totalAssignedJobs;
    }
    // Check if all workers have completed their jobs
    areAllWorkersCompleted() {
        return this.totalCompletedWorkers >= this.workers.length;
    }
    // Notify workers when all jobs are completed
    notifyWorkersIfJobsComplete() {
        if (this.areAllJobsCompleted()) {
            for (const worker of this.workers) {
                worker.postMessage({ isCompleted: true });
            }
        }
    }
    // Notify workers to stop execution
    notifyWorkersToStop() {
        if (this.forceStop) {
            for (const worker of this.workers) {
                worker.postMessage({ isStopped: true });
            }
        }
    }
    // Terminate workers if autoTerminate is enabled or all workers are completed
    terminateWorkersIfAllComplete() {
        if (this.canAutoTerminate() && this.areAllWorkersCompleted()) {
            this.terminateAllWorkers();
        }
    }
    // Terminate all workers and clean up
    terminateAllWorkers() {
        for (const worker of this.workers) {
            worker.removeAllListeners();
            worker.terminate();
        }
        this.areWorkersTerminated = true;
        this.clearWorkerPool();
    }
    canAutoTerminate() {
        return this.config?.autoTerminate == true;
    }
    // Reset the worker pool state
    resetPoolState() {
        this.lastWorkerIndex = 0;
        this.totalAssignedJobs = 0;
        this.totalCompletedJobs = 0;
        this.totalCompletedWorkers = 0;
        this.forceStop = false;
    }
    clearWorkerPool() {
        this.workers = [];
    }
    clearResults() {
        this.results = [];
    }
    // Add a new job to the worker pool
    add(fn, ...params) {
        if (this.areWorkersTerminated) {
            return new Error(constants_1.ERROR_NO_ACTIVE_WORKERS);
        }
        const worker = this.getNextWorker();
        const serializedFn = fn.toString();
        worker.postMessage({ fn: serializedFn, params });
        this.totalAssignedJobs++;
    }
    // Retrieve results as a Promise
    result() {
        return new Promise((resolve) => {
            if (this.totalAssignedJobs < 1) {
                this.terminateAllWorkers();
                return resolve(this.results);
            }
            const onWorkerCompleted = () => {
                if (this.areAllWorkersCompleted()) {
                    this.eventEmitter.removeListener(constants_1.WORKER_COMPLETED, onWorkerCompleted);
                    const finalResults = [...this.results];
                    this.resetPoolState();
                    this.clearResults();
                    return resolve(finalResults);
                }
            };
            this.eventEmitter.on(constants_1.WORKER_COMPLETED, onWorkerCompleted);
        });
    }
    // Stop all worker execution
    stop() {
        this.forceStop = true;
        this.notifyWorkersToStop();
    }
    // Manually terminate all workers
    async terminate() {
        await this.result();
        this.config.autoTerminate = true;
        this.terminateAllWorkers();
        this.resetPoolState();
        this.clearWorkerPool();
        this.clearResults();
    }
}
exports.NoderPool = NoderPool;
const noder = async function (fn, ...params) {
    return new Promise((res, _rej) => {
        try {
            const workerFile = path.resolve(__dirname, 'worker.js'); // Resolve path dynamically
            const worker = new worker_threads_1.Worker(workerFile);
            const serializedFn = fn.toString();
            worker.postMessage({ fn: serializedFn, params });
            worker.on('message', (message) => {
                const { event, data } = message;
                switch (event) {
                    case constants_1.WORKER_RESULT:
                        res(data);
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
        }
        catch (error) {
            res(error);
        }
    });
};
exports.noder = noder;
