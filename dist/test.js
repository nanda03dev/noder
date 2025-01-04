"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
function testNoder() {
    console.time('workerExecution');
    for (let i = 0; i < 5; i++) {
        (0, index_1.noder)(fib, 39);
    }
    console.timeEnd('workerExecution');
    const result = fib(45);
    console.log('Result from sync fib: ', result);
}
async function testNoderPool() {
    const noderPool = new index_1.NoderPool({ workerCount: 7 });
    for (let i = 0; i < 70; i++) {
        noderPool.add(fib, 37);
    }
    const results = await noderPool.result();
    console.log('Results from pool: ', results.length);
}
function fib(n) {
    if (n <= 1)
        return n;
    return fib(n - 1) + fib(n - 2);
}
(function main() {
    // Uncomment to test individual functions
    // testNoder();
    testNoderPool();
})();
