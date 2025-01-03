# noder 🧵  
Effortlessly execute CPU-intensive tasks in parallel with worker threads.  
**noder** simplifies concurrency in Node.js by providing support for creating individual workers and worker pools with easy-to-use syntax.  

## Features 🚀  
- **Simple Syntax:** Execute tasks with just a single function call.  
- **Worker Pool Support:** Manage multiple tasks with a pool of workers.  
- **Async/Await Friendly:** Easily handle results from tasks.  

---

## Installation 📦  
```bash
npm install noder
```

---

## Usage 📖  

### 1. Execute a Single Task  
Run a CPU-intensive task in its own worker thread:  
```javascript
const { noder } = require('noder');

const fib = (num) => (num <= 1 ? num : fib(num - 1) + fib(num - 2));

(async () => {
    const result = await noder(fib, 39); // Execute in a worker thread
    console.log('Result:', result);
})();
```

---

### 2. Using a Worker Pool  
Efficiently manage multiple tasks with a worker pool:  
```javascript
const { NoderPool } = require('noder');

const fib = (num) => (num <= 1 ? num : fib(num - 1) + fib(num - 2));

// Create a pool of 7 workers
const noderPool = new NoderPool({ workerCount: 7 });

(async () => {
    // Add 70 tasks to the pool
    for (let i = 0; i < 70; i++) {
        noderPool.add(fib, 37); // Assign jobs to the pool
    }

    // Wait for all results
    const results = await noderPool.result();
    console.log('Results:', results);
})();
```

---

## Key Concepts 🗝️  

### 1. **Worker Threads**  
`noder` internally uses Node.js `worker_threads` to execute tasks in parallel without blocking the main thread.  

### 2. **Worker Pool**  
With `NoderPool`, you can:  
- Specify the number of workers in the pool (`workerCount`).  
- Add jobs to the pool.  
- Retrieve results after all tasks are completed.  

---

## API Reference 📚  

### **noder(fn, ...params): Promise**  
- Executes a function in a separate worker thread.  
- **Parameters**:  
  - `fn` (Function): The function to execute.  
  - `params` (Array): The parameters to pass to the function.  
- **Returns**: A `Promise` resolving to the result of the function.  

---

### **NoderPool(config)**  
Creates a pool of workers.  

#### **Constructor Options**  
- `config.workerCount` (Number): Number of workers in the pool (default: `2`).  

#### **Methods**  
- **`add(fn, ...params): void`**  
  Adds a job to the pool.  
  - `fn` (Function): The function to execute.  
  - `params` (Array): Parameters for the function.  

- **`result(): Promise<Array>`**  
  Waits for all jobs to complete and returns their results.  

---

## Performance Tips 🏎️  

1. **Worker Count**:  
   The optimal number of workers depends on your system's CPU cores. Using too many workers might lead to overhead.  

2. **Task Complexity**:  
   For smaller tasks, the overhead of creating workers might outweigh the performance benefits. Use workers for CPU-intensive tasks.  

---

## License 📝  
This package is licensed under the [MIT License](./LICENSE).  

---

## Contributing 🤝  
Contributions are welcome! If you have ideas for improvements or features, feel free to open an issue or submit a pull request.  

---

## Acknowledgments 🙌  
This package leverages Node.js `worker_threads` to make parallel execution easy for developers.  

Enjoy building faster and more efficient Node.js applications with **noder**! 🚀  

---