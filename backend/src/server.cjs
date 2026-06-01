// CommonJS launcher for the current ESM backend.
// Kept for compatibility with tools or scripts that expect a `.cjs` entrypoint.
(async () => {
  try {
    await import("./server.js");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
})();
