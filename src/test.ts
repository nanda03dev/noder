
import { noder, NoderPool } from "./index"

function testNoder(): void {
    console.time('workerExecution');
    for (let i = 0; i < 5; i++) {
        noder(fib, 39);
    }
    console.timeEnd('workerExecution');
    const result = fib(45);

    console.log('Result from sync fib: ', result);
}

async function testNoderPool(): Promise<void> {
    const noderPool = new NoderPool({ workerCount: 7, autoTerminate: false });
    for (let i = 0; i < 70; i++) {
        noderPool.add(fib, 30);
    }
    const results = await noderPool.result();
    console.log('Results from pool: ', results.length);

    noderPool.add(fib, 39);

    // const results2 = await noderPool.result();
    // console.log('Results from pool2: ', results2.length);

    noderPool.terminate()
    console.log(" terminated called")
}

function voidFunction() {
    console.log("log")
}
function fib(n: number): number {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}

(function main(): void {
    // Uncomment to test individual functions
    // testNoder();
    testNoderPool();
})();
