// Windows Expo --localhost can listen on ::1 only. ADB reverse connects to IPv4.
// Keep Metro on loopback; bridge only the missing 127.0.0.1 listener for device QA.
const net = require("node:net");
const server = net.createServer((client) => {
  const metro = net.connect({ host: "::1", port: 8081 });
  client.on("error", () => metro.destroy());
  metro.on("error", () => client.destroy());
  client.pipe(metro);
  metro.pipe(client);
  client.on("close", () => metro.destroy());
  metro.on("close", () => client.destroy());
});
server.listen(8081, "127.0.0.1", () =>
  console.log("Phase 5 Metro IPv4 loopback -> IPv6 loopback ready"),
);
server.on("error", (error) => {
  console.error(error.code);
  process.exitCode = 1;
});
