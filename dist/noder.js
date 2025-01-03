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
        this.worker_max_count = 30;
        this.worker_min_count = 2;
        this.last_selected_worker_index = 0;
        this.job_count = 0;
        this.completed_job_count = 0;
        this.completed_worker_count = 0;
        this.force_stop = false;
        this.workers = [];
        this.config = { workerCount: this.worker_min_count };
        this.results = [];
        this.eventEmitter = new events_1.EventEmitter();
        if (config.workerCount > this.worker_max_count) {
            console.warn(`Warning: You have requested to create ${config.workerCount} workers, which exceeds the recommended limit of ${this.worker_max_count} workers.`);
            console.warn('Using too many workers may lead to performance issues or system resource constraints.');
            console.warn('It is recommended to adjust the worker count to a lower value.');
        }
        this.config = config;
        this.spawnWorkers();
    }
    spawnWorkers() {
        const workerFile = path.resolve(__dirname, 'worker.js');
        for (let i = 0; i < this.config.workerCount; i++) {
            const worker = new worker_threads_1.Worker(workerFile);
            this.workers.push(worker);
            this.listenFromWorker(worker);
        }
    }
    getWorker() {
        const workerLength = this.workers.length;
        if (this.last_selected_worker_index >= workerLength) {
            this.last_selected_worker_index = 0;
        }
        this.last_selected_worker_index++;
        return this.workers[this.last_selected_worker_index - 1];
    }
    listenFromWorker(worker) {
        worker.on('message', (message) => {
            // console.log("message ", message)
            const { event, data } = message;
            // console.log("message ", message)
            switch (event) {
                case constants_1.WORKER_RESULT:
                    this.results.push(data);
                    this.completed_job_count += 1;
                    this.sendWorkCompleteEvent();
                    break;
                case constants_1.WORKER_ERROR:
                    this.completed_job_count += 1;
                    this.sendWorkCompleteEvent();
                    break;
                case constants_1.WORKER_COMPLETED:
                    this.completed_worker_count++;
                    this.terminateAllWorkers();
                    this.eventEmitter.emit(constants_1.WORKER_COMPLETED, data);
                    break;
            }
        });
    }
    checkIsJobCompleted() {
        return this.completed_job_count >= this.job_count;
    }
    checkIsWorkerCompleted() {
        return this.completed_worker_count >= this.workers.length;
    }
    sendWorkCompleteEvent() {
        if (this.checkIsJobCompleted()) {
            for (const worker of this.workers) {
                worker.postMessage({ isCompleted: true });
            }
        }
    }
    sendWorkStopEvent() {
        if (this.force_stop) {
            for (const worker of this.workers) {
                worker.postMessage({ isStopped: true });
            }
        }
    }
    terminateAllWorkers() {
        if (this.checkIsWorkerCompleted()) {
            for (const worker of this.workers) {
                worker.removeAllListeners();
                worker.terminate();
            }
        }
    }
    add(fn, ...params) {
        const worker = this.getWorker();
        const serializedFn = fn.toString();
        worker.postMessage({ fn: serializedFn, params });
        this.job_count += 1;
    }
    result() {
        return new Promise((resolve) => {
            const onWorkerCompleted = () => {
                if (this.checkIsWorkerCompleted()) {
                    this.eventEmitter.removeListener(constants_1.WORKER_COMPLETED, onWorkerCompleted); // Manually remove listener
                    return resolve(this.results);
                }
            };
            this.eventEmitter.on(constants_1.WORKER_COMPLETED, onWorkerCompleted);
        });
    }
    stop() {
        this.force_stop = true;
        this.sendWorkStopEvent();
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
