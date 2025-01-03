import { parentPort } from 'worker_threads';
import { WORKER_COMPLETED, WORKER_ERROR, WORKER_RESULT } from './constants';

if (parentPort !== null) {
    parentPort.on('message', async (data: { fn: string; params: any[], isCompleted: boolean, isStopped: boolean }) => {
        const { fn, params, isCompleted, isStopped } = data;
        // console.log("params ", params)
        try {
            // If the `isCompleted` flag is true, send a specific event to the main thread
            if (isCompleted || isStopped) {
                parentPort?.postMessage({ event: WORKER_COMPLETED, message: 'Worker has finished processing.' });
                return; // Early return to skip further processing
            }

            // Deserialize the function string into a callable function
            const dynamicFn = new Function(`return (${fn})`)();

            // Execute the function with the provided parameters
            const result = await dynamicFn(...params);

            // Send the result back to the main thread
            parentPort?.postMessage({ event: WORKER_RESULT, data: result });

        } catch (error: any) {
            // Handle errors in function execution
            parentPort?.postMessage({ event: WORKER_ERROR, message: `Error executing function: ${error.message}` });
        }
    });
}
