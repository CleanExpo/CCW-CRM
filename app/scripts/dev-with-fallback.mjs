import { spawn } from "node:child_process";
import net from "node:net";

const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const basePort = Number.isFinite(parsedPort) ? parsedPort : 3005;
const candidates = [basePort, basePort + 1, basePort + 2].filter(Number.isFinite);
const ports = Array.from(new Set(candidates));

const isPortAvailable = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "::", () => {
      server.close(() => resolve(true));
    });
  });

const pickPort = async () => {
  for (const port of ports) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
};

const start = async () => {
  const port = await pickPort();
  if (!port) {
    console.error(`No available port found in ${ports.join(", ")}.`);
    process.exit(1);
  }

  if (port !== basePort) {
    console.log(`Port ${basePort} is busy. Starting Next.js on ${port}.`);
  }

  const child = spawn("next", ["dev", "-p", String(port)], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PORT: String(port) },
  });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });
};

start();
