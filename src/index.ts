import { Worker } from 'worker_threads';
import * as path from 'path';
import { EventEmitter } from 'events';
import { WORKER_COMPLETED, WORKER_ERROR, WORKER_RESULT } from './constants';

interface NoderPoolConfig {
    workerCount: number;
}

export class NoderPool {
    private readonly worker_max_count = 30;
    private readonly worker_min_count = 2;
    private last_selected_worker_index = 0;

    private job_count = 0;
    private completed_job_count = 0;
    private completed_worker_count = 0;

    private force_stop = false

    private workers: Worker[] = [];
    private config: NoderPoolConfig = { workerCount: this.worker_min_count };
    private results: any[] = [];
    private eventEmitter: EventEmitter = new EventEmitter();

    constructor(config: NoderPoolConfig = { workerCount: 2 }) {
        if (config.workerCount > this.worker_max_count) {
            console.warn(`Warning: You have requested to create ${config.workerCount} workers, which exceeds the recommended limit of ${this.worker_max_count} workers.`);
            console.warn('Using too many workers may lead to performance issues or system resource constraints.');
            console.warn('It is recommended to adjust the worker count to a lower value.');
        }
        this.config = config;
        this.spawnWorkers();
    }

    private spawnWorkers(): void {
        const workerFile = path.resolve(__dirname, 'worker.js');
        for (let i = 0; i < this.config.workerCount; i++) {
            const worker = new Worker(workerFile);
            this.workers.push(worker);
            this.listenFromWorker(worker);
        }
    }

    private getWorker(): Worker {
        const workerLength = this.workers.length;
        if (this.last_selected_worker_index >= workerLength) {
            this.last_selected_worker_index = 0;
        }
        this.last_selected_worker_index++
        return this.workers[this.last_selected_worker_index - 1];
    }

    private listenFromWorker(worker: Worker): void {
        worker.on('message', (message) => {
            const { event, data } = message;
            switch (event) {
                case WORKER_RESULT:
                    this.results.push(data);
                    this.completed_job_count += 1;
                    this.sendWorkCompleteEvent()
                    break;
                case WORKER_ERROR:
                    this.completed_job_count += 1;
                    this.sendWorkCompleteEvent()
                    break;
                case WORKER_COMPLETED:
                    this.completed_worker_count++
                    this.terminateAllWorkers()
                    this.eventEmitter.emit(WORKER_COMPLETED, data);
                    break;
            }
        });
    }

    private checkIsJobCompleted(): boolean {
        return this.completed_job_count >= this.job_count;
    }
    private checkIsWorkerCompleted(): boolean {
        return this.completed_worker_count >= this.workers.length
    }
    private sendWorkCompleteEvent(): void {
        if (this.checkIsJobCompleted()) {
            for (const worker of this.workers) {
                worker.postMessage({ isCompleted: true });
            }
        }
    }

    private sendWorkStopEvent() {
        if (this.force_stop) {
            for (const worker of this.workers) {
                worker.postMessage({ isStopped: true });
            }
        }
    }

    private terminateAllWorkers() {
        if (this.checkIsWorkerCompleted()) {
            for (const worker of this.workers) {
                worker.removeAllListeners();
                worker.terminate()
            }
        }
    }

    public add(fn: (...args: any[]) => any, ...params: unknown[]): void {
        const worker = this.getWorker();
        const serializedFn = fn.toString();
        worker.postMessage({ fn: serializedFn, params });
        this.job_count += 1;
    }


    public result(): Promise<any[]> {
        return new Promise((resolve) => {
            const onWorkerCompleted = () => {
                if (this.checkIsWorkerCompleted()) {
                    this.eventEmitter.removeListener(WORKER_COMPLETED, onWorkerCompleted);  // Manually remove listener
                    return resolve(this.results);
                }
            };

            this.eventEmitter.on(WORKER_COMPLETED, onWorkerCompleted);
        });
    }

    public stop() {
        this.force_stop = true
        this.sendWorkStopEvent()
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
