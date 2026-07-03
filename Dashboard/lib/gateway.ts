/** Translate-gateway diagnosis: separates the control plane (GET /models reachability)
 *  from the data plane (chat completion responding). Pure — unit-tested in gateway.test.ts.
 *  This is the 2026-06-14 incident signature: /models OK in 0.19s but a 16-token completion
 *  hung ~151s → the inference backend, not the gateway, was down. */

export type DataState = "ok" | "slow" | "timeout" | "error";

export interface GatewayProbe {
  controlOk: boolean; // GET /models returned 200
  controlMs: number; // its latency
  dataState: DataState; // chat completion outcome
  dataMs: number; // its latency / time-to-timeout
}

export interface GatewayDiagnosis {
  plane: "healthy" | "control-plane" | "data-plane";
  cause: string;
  hint: string;
}

export function diagnoseGateway(p: GatewayProbe): GatewayDiagnosis {
  if (!p.controlOk) {
    return {
      plane: "control-plane",
      cause: "gateway unreachable",
      hint: `GET /models failed — gateway / control plane is down. Check the endpoint and network.`,
    };
  }
  if (p.dataState === "timeout") {
    return {
      plane: "data-plane",
      cause: "model not responding",
      hint: `Control plane up (/models ${(p.controlMs / 1000).toFixed(2)}s) but chat completion timed out (${(p.dataMs / 1000).toFixed(0)}s) → inference backend hung. A retry will fail; restart / check the model.`,
    };
  }
  if (p.dataState === "error") {
    return { plane: "data-plane", cause: "inference error", hint: `Gateway reachable but the model returned an error. Check model / token.` };
  }
  if (p.dataState === "slow") {
    return { plane: "data-plane", cause: "model slow", hint: `Gateway reachable; completion responded but slowly (${(p.dataMs / 1000).toFixed(0)}s). Watch for a creeping timeout.` };
  }
  return { plane: "healthy", cause: "ok", hint: `Control + data plane healthy.` };
}
