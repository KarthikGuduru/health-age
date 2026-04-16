// Thin client that offloads the heavy XML streaming + parse work to a
// Web Worker so the main thread stays responsive while a huge Apple
// Health export is being processed.

export function parseHealthExport(file, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('./parseHealthData.worker.js', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        if (onProgress) onProgress(data);
      } else if (type === 'done') {
        worker.terminate();
        resolve(data);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(data));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ file });
  });
}
