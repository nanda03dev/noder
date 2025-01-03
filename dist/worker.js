"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const constants_1 = require("./constants");
if (worker_threads_1.parentPort !== null) {
    worker_threads_1.parentPort.on('message', async (data) => {
        const { fn, params, isCompleted, isStopped } = data;
        // console.log("params ", params)
        try {
            // If the `isCompleted` flag is true, send a specific event to the main thread
            if (isCompleted || isStopped) {
                worker_threads_1.parentPort?.postMessage({ event: constants_1.WORKER_COMPLETED, message: 'Worker has finished processing.' });
                return; // Early return to skip further processing
            }
            // Deserialize the function string into a callable function
            const dynamicFn = new Function(`return (${fn})`)();
            // Execute the function with the provided parameters
            const result = await dynamicFn(...params);
            // Send the result back to the main thread
            worker_threads_1.parentPort?.postMessage({ event: constants_1.WORKER_RESULT, data: result });
        }
        catch (error) {
            // Handle errors in function execution
            worker_threads_1.parentPort?.postMessage({ event: constants_1.WORKER_ERROR, message: `Error executing function: ${error.message}` });
        }
    });
}
