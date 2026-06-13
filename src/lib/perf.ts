// 耗時量測：perfStart('label') 回傳結束函數，呼叫時輸出 [perf] label XXXms。
// 只在 __DEV__ 輸出；release build 為 no-op。
export function perfStart(label: string): () => void {
  if (!__DEV__) return () => {};
  const t0 = Date.now();
  return () => {
    console.log(`[perf] ${label} ${Date.now() - t0}ms`);
  };
}
