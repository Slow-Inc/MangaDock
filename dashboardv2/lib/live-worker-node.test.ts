import { test, expect } from "bun:test";
import { liveWorkerNode } from "./live-worker-node";
import { MOCK_MIT } from "./mock-live";

const worker = MOCK_MIT.workersDetail![0];

test("maps live GPU/host telemetry onto the worker node", () => {
  const n = liveWorkerNode(MOCK_MIT, worker);
  expect(n.id).toBe("w-5014");
  expect(n.online).toBe(true);
  expect(n.gpuUsage).toBe(64);
  expect(n.vramUsedGb).toBe(5.8);
  expect(n.vramTotalGb).toBe(12.3);
  expect(n.gpuTempC).toBe(67);
  expect(n.powerW).toBe(182);
  expect(n.cpuUsage).toBe(42);
  expect(n.ramUsedGb).toBe(9.8);
});

test("fields MIT does not emit stay null → No Data (honest)", () => {
  const n = liveWorkerNode(MOCK_MIT, worker);
  expect(n.gpuClockMhz).toBeNull();
  expect(n.cpuClockMhz).toBeNull();
  expect(n.cpuTempC).toBeNull();
  expect(n.bandwidthMbps).toBeNull();
});

test("surfaces the leaked model as an error", () => {
  const n = liveWorkerNode(MOCK_MIT, worker);
  expect(n.errors).toContain("render-fonts VRAM not freed — leak 920MB");
});

test("no-GPU snapshot degrades without throwing", () => {
  const n = liveWorkerNode({ ...MOCK_MIT, gpu: null }, worker);
  expect(n.gpuUsage).toBeNull();
  expect(n.vramUsedGb).toBeNull();
  expect(n.cpuUsage).toBe(42); // host metrics still present
});

test("passes recent logs through", () => {
  const n = liveWorkerNode(MOCK_MIT, worker, ["[16:10] translate timeout"]);
  expect(n.logs).toEqual(["[16:10] translate timeout"]);
});
