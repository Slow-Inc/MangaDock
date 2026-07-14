import Fastify from "fastify";
import basicAuth from "@fastify/basic-auth";
import { config } from "./config";
import { registry } from "./metrics";
import { startProbeLoop } from "./probes";

const fastify = Fastify({ logger: true });

await fastify.register(basicAuth, {
  validate: async (username, password, _req, _reply) => {
    if (
      username !== config.METRICS_BASIC_AUTH_USER ||
      password !== config.METRICS_BASIC_AUTH_PASS
    ) {
      return new Error("Unauthorized");
    }
  },
  authenticate: true,
});

fastify.get("/health", async () => ({
  status: "ok",
  uptime: Math.floor(process.uptime()),
}));

fastify.get(
  "/metrics",
  { onRequest: fastify.basicAuth },
  async (_req, reply) => {
    reply.header("Content-Type", registry.contentType);
    return registry.metrics();
  },
);

startProbeLoop();

await fastify.listen({ port: config.PORT, host: "0.0.0.0" });
