export function bindErrors() {
  window.addEventListener("error", (event) => {
    console.error("Global Error:", {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack || event.error,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled Promise Rejection:", {
      reason: event.reason,
      promise: event.promise,
      stack: event.reason?.stack,
    });
  });
}
