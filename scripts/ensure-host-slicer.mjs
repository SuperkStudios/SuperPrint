import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.HOST_SLICER_PORT ?? 4317);
const host = process.env.HOST_SLICER_HOST ?? "127.0.0.1";
const stateDir = path.join(repoRoot, ".superprint");
const pidPath = path.join(stateDir, "host-slicer.pid");
const logPath = path.join(stateDir, "host-slicer.log");
const estimatorPath = path.join(repoRoot, "scripts/host-slicer-estimator.mjs");
const dockerImage = process.env.HOST_SLICER_DOCKER_IMAGE ?? "curlimages/curl:8.11.1";
const healthUrl = `http://${host}:${port}/healthz`;

await main();

async function main() {
  await mkdir(stateDir, { recursive: true });

  if (await isHealthy(healthUrl)) {
    await verifyDockerReachability();
    console.log(`Host slicer is already listening at ${healthUrl}`);
    return;
  }

  await removeDeadPid();
  await startSlicer();
  await waitForHealth();
  await verifyDockerReachability();
  console.log(`Host slicer is ready at ${healthUrl}`);
  console.log(`Log: ${logPath}`);
}

async function startSlicer() {
  const out = await openLogFile();
  const child = spawn(process.execPath, [estimatorPath], {
    cwd: repoRoot,
    detached: true,
    env: {
      ...process.env,
      HOST_SLICER_HOST: host,
      HOST_SLICER_PORT: String(port)
    },
    stdio: ["ignore", out, out]
  });
  fs.closeSync(out);
  child.unref();
  await writeFile(pidPath, `${child.pid}\n`);
  console.log(`Started host slicer estimator with pid ${child.pid}`);
}

function openLogFile() {
  return fs.openSync(logPath, "a");
}

async function removeDeadPid() {
  if (!existsSync(pidPath)) return;
  const rawPid = (await readFile(pidPath, "utf8")).trim();
  const pid = Number(rawPid);
  if (!Number.isInteger(pid) || pid <= 0 || !isProcessAlive(pid)) {
    await rm(pidPath, { force: true });
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForHealth() {
  const started = Date.now();
  const timeoutMs = 20_000;
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    const result = await getJson(healthUrl);
    if (result.ok) return;
    lastError = result.error ?? `HTTP ${result.status ?? "unavailable"}`;
    await delay(500);
  }

  throw new Error(`Host slicer did not become healthy within ${timeoutMs / 1000}s: ${lastError}. See ${logPath}`);
}

async function isHealthy(url) {
  const result = await getJson(url);
  return result.ok === true;
}

async function getJson(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    const body = await response.json().catch(() => ({}));
    return { ...body, status: response.status, ok: response.ok && body.ok === true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "request failed" };
  }
}

async function verifyDockerReachability() {
  if (!await canConnectToDocker()) {
    console.log("Docker is not reachable from this shell, so only the host health check was completed.");
    return;
  }

  await run("docker", [
    "run",
    "--rm",
    dockerImage,
    "-fsS",
    `http://host.docker.internal:${port}/healthz`
  ]);
  console.log(`Docker can reach http://host.docker.internal:${port}/healthz`);
}

function canConnectToDocker() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ path: "/var/run/docker.sock" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${code}`));
      }
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
