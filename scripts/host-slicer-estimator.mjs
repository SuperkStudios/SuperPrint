import http from "node:http";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { materializeSlicerProfileSet } from "./host-slicer-profiles.mjs";

const port = Number(process.env.HOST_SLICER_PORT ?? 4317);
const host = process.env.HOST_SLICER_HOST ?? "127.0.0.1";
const homeDir = os.homedir();
const orcaDataDir = path.join(homeDir, "Library/Application Support/OrcaSlicer");
const elegooDataDir = path.join(homeDir, "Library/Application Support/ElegooSlicer");

const centauriEstimatePatch = {
  machine: {
    machine_max_acceleration_x: ["5300", "5300"],
    machine_max_acceleration_y: ["5300", "5300"],
    machine_max_acceleration_extruding: ["5300", "5300"],
    machine_max_acceleration_retracting: ["5300", "5300"]
  },
  process: {
    default_acceleration: "10000",
    outer_wall_acceleration: "10000",
    inner_wall_acceleration: "10000",
    sparse_infill_acceleration: "10000",
    top_surface_acceleration: "10000",
    outer_wall_speed: "160",
    inner_wall_speed: "200",
    sparse_infill_speed: "200",
    internal_solid_infill_speed: "250",
    gap_infill_speed: "250",
    top_surface_speed: "200",
    initial_layer_speed: "50",
    initial_layer_infill_speed: "105",
    sparse_infill_density: "17%"
  }
};

const slicers = [
  {
    name: "OrcaSlicer",
    bin: "/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer",
    datadir: orcaDataDir,
    machine: path.join(orcaDataDir, "system/Elegoo/machine/ECC/Elegoo Centauri Carbon 0.4 nozzle.json"),
    process: path.join(orcaDataDir, "system/Elegoo/process/ECC/0.20mm Standard @Elegoo CC 0.4 nozzle.json"),
    filament: path.join(orcaDataDir, "system/Elegoo/filament/ECC/Elegoo PLA @ECC.json"),
    filamentDirectories: [
      path.join(orcaDataDir, "system/Elegoo/filament/ECC"),
      path.join(orcaDataDir, "user/default/filament")
    ],
    patch: centauriEstimatePatch
  },
  {
    name: "ElegooSlicer",
    bin: "/Applications/ElegooSlicer.app/Contents/MacOS/ElegooSlicer",
    datadir: elegooDataDir,
    machine: path.join(elegooDataDir, "system/Elegoo/machine/ECC/Elegoo Centauri Carbon 0.4 nozzle.json"),
    process: path.join(elegooDataDir, "system/Elegoo/process/ECC/0.20mm Standard @Elegoo CC 0.4 nozzle.json"),
    filament: path.join(elegooDataDir, "system/Elegoo/filament/ECC/Elegoo PLA @ECC.json"),
    filamentDirectories: [
      path.join(elegooDataDir, "system/Elegoo/filament/ECC"),
      path.join(elegooDataDir, "user/default/filament")
    ],
    patch: centauriEstimatePatch
  },
  {
    name: "OrcaSlicer",
    bin: "/Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer",
    machine: "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/machine/ECC/Elegoo Centauri Carbon 0.4 nozzle.json",
    process: "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/process/ECC/0.20mm Standard @Elegoo CC 0.4 nozzle.json",
    filament: "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/filament/ELEGOO/Elegoo PLA.json",
    filamentDirectories: [
      "/Applications/OrcaSlicer.app/Contents/Resources/profiles/Elegoo/filament/ELEGOO"
    ]
  }
];

const materialDensities = {
  PLA: 1.24,
  PETG: 1.27,
  ABS: 1.04,
  TPU: 1.21,
  NYLON: 1.14,
  RESIN: 1.1
};

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    try {
      const selected = resolveSlicer();
      sendJson(response, 200, {
        ok: true,
        slicer: selected.name,
        port,
        host
      });
    } catch (error) {
      sendJson(response, 503, {
        ok: false,
        error: error instanceof Error ? error.message : "No slicer configured"
      });
    }
    return;
  }

  if (request.method !== "POST" || !["/estimate", "/slice-plate"].includes(request.url ?? "")) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJson(request);
    const fileName = safeFileName(String(body.fileName ?? "model.stl"));
    const dataBase64 = String(body.dataBase64 ?? "");
    if (!dataBase64) throw new Error("dataBase64 is required");

    const estimate = request.url === "/slice-plate"
      ? await slicePlateWithSlicer({
          fileName,
          material: String(body.material ?? "PLA"),
          buffer: Buffer.from(dataBase64, "base64"),
          quantity: Math.max(1, Math.min(250, Math.round(Number(body.quantity ?? 1))))
        })
      : await estimateWithSlicer({
          fileName,
          material: String(body.material ?? "PLA"),
          buffer: Buffer.from(dataBase64, "base64")
        });

    sendJson(response, 200, estimate);
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : "Could not estimate print file" });
  }
});

server.listen(port, host, () => {
  console.log(`Host slicer estimator listening at http://${host}:${port}/estimate`);
});

async function estimateWithSlicer(input) {
  const result = await slicePlateWithSlicer({ ...input, quantity: 1 });
  const { gcodeBase64, ...estimate } = result;
  return estimate;
}

async function slicePlateWithSlicer(input) {
  const selected = resolveSlicer();
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "superprint-slicer-"));
  try {
    const quantity = Math.max(1, input.quantity ?? 1);
    const inputPaths = isThreeMfFile(input.fileName) && quantity > 1
      ? [await buildExpandedThreeMf({ ...input, quantity, tmpDir })]
      : await writeRepeatedInputFiles({ ...input, quantity, tmpDir });
    const profiles = await materializeSlicerProfileSet({
      slicer: selected,
      material: input.material,
      tmpDir
    });

    const args = [
      "--slice",
      "0",
      "--outputdir",
      tmpDir,
      "--load-settings",
      `${profiles.machine};${profiles.process}`,
      "--load-filaments",
      profiles.filament,
      ...inputPaths
    ];
    if (selected.datadir) args.unshift("--datadir", selected.datadir);
    await run(selected.bin, args);

    const gcodePath = await findGcode(tmpDir);
    const gcode = await readFile(gcodePath, "utf8");
    const parsed = parseSlicerGcode(gcode, input.material);
    if (!parsed.estimatedPrintMinutes || !parsed.estimatedGrams) {
      throw new Error(`${selected.name} sliced the file but did not report usable estimates`);
    }
    return {
      ...parsed,
      gcodeBase64: Buffer.from(gcode).toString("base64"),
      source: "slicer",
      message: `${selected.name} ${path.basename(profiles.process)} using ${String(input.material).toUpperCase()} settings for ${inputPaths.length} object(s)`
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function writeRepeatedInputFiles(input) {
  const inputPaths = [];
  for (let index = 0; index < input.quantity; index += 1) {
    const inputPath = path.join(input.tmpDir, `${randomUUID()}-${index + 1}-${input.fileName}`);
    await writeFile(inputPath, input.buffer);
    inputPaths.push(inputPath);
  }
  return inputPaths;
}

async function buildExpandedThreeMf(input) {
  const sourcePath = path.join(input.tmpDir, `${randomUUID()}-${input.fileName}`);
  const unpackedDir = path.join(input.tmpDir, `${randomUUID()}-3mf`);
  const outputPath = path.join(input.tmpDir, `${randomUUID()}-expanded-${input.fileName}`);
  await writeFile(sourcePath, input.buffer);
  await mkdir(unpackedDir, { recursive: true });
  await run("unzip", ["-q", sourcePath, "-d", unpackedDir]);

  const modelPath = path.join(unpackedDir, "3D", "3dmodel.model");
  const model = await readFile(modelPath, "utf8");
  const expanded = expandThreeMfBuildItems(model, input.quantity, input.fileName);
  await writeFile(modelPath, expanded);
  await run("zip", ["-qr", outputPath, "."], { cwd: unpackedDir });
  return outputPath;
}

function expandThreeMfBuildItems(model, quantity, fileName) {
  const itemMatch = model.match(/<item\b[^>]*objectid="([^"]+)"[^>]*transform="([^"]+)"[^>]*\/>/);
  if (!itemMatch) return model;
  const objectId = itemMatch[1];
  const baseTransform = itemMatch[2].trim().split(/\s+/).map(Number);
  const z = Number.isFinite(baseTransform[11]) ? baseTransform[11] : 0;
  const positions = buildCopyPositions(quantity, fileName);
  const items = positions.map(({ x, y }, index) => {
    const transform = `1 0 0 0 1 0 0 0 1 ${x} ${y} ${z}`;
    return `  <item objectid="${objectId}" p:UUID="${uuidForBuildItem(index + 1)}" transform="${transform}" printable="1"/>`;
  }).join("\n");
  return model.replace(/<build\b([^>]*)>[\s\S]*?<\/build>/, `<build$1>\n${items}\n </build>`);
}

function buildCopyPositions(quantity, fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes("connector")) {
    const yStart = quantity <= 4 ? 96 : 53;
    return Array.from({ length: quantity }, (_, index) => ({
      x: index < 8 ? 42 : 82,
      y: yStart + (index % 8) * 22
    }));
  }
  const columns = quantity <= 2 ? quantity : Math.ceil(Math.sqrt(quantity));
  const rows = Math.ceil(quantity / columns);
  const spacing = lower.includes("gear") ? 68 : 56;
  const startX = 128 - ((columns - 1) * spacing) / 2;
  const startY = 128 - ((rows - 1) * spacing) / 2;
  return Array.from({ length: quantity }, (_, index) => ({
    x: Number((startX + (index % columns) * spacing).toFixed(3)),
    y: Number((startY + Math.floor(index / columns) * spacing).toFixed(3))
  }));
}

function uuidForBuildItem(index) {
  return `000000${String(index).padStart(2, "0")}-b1ec-4553-aec9-835e5b724bb4`;
}

function isThreeMfFile(fileName) {
  return /\.3mf$/i.test(fileName);
}

function resolveSlicer() {
  const explicit = {
    name: process.env.HOST_SLICER_NAME ?? "ConfiguredSlicer",
    bin: process.env.HOST_SLICER_BIN,
    datadir: process.env.HOST_SLICER_DATADIR,
    machine: process.env.HOST_SLICER_MACHINE_PROFILE,
    process: process.env.HOST_SLICER_PROCESS_PROFILE,
    filament: process.env.HOST_SLICER_FILAMENT_PROFILE
  };
  if (explicit.bin && explicit.machine && explicit.process && explicit.filament) return explicit;

  const found = slicers.find((item) => [item.bin, item.machine, item.process, item.filament].every((file) => existsSync(file)));
  if (!found) {
    throw new Error("No configured ElegooSlicer or OrcaSlicer profile set was found. Set HOST_SLICER_BIN, HOST_SLICER_MACHINE_PROFILE, HOST_SLICER_PROCESS_PROFILE, and HOST_SLICER_FILAMENT_PROFILE.");
  }
  return found;
}

function parseSlicerGcode(text, material) {
  const directGrams =
    numericMatch(text, /;\s*(?:total\s+)?filament used \[g\]\s*[=:]\s*([0-9.]+)/i) ??
    numericMatch(text, /filament used \[g\]:\s*([0-9.]+)/i);
  const volumeCm3 = numericMatch(text, /;\s*filament used \[cm3\]\s*[=:]\s*([0-9.]+)/i);
  const density = materialDensities[String(material).toUpperCase()] ?? materialDensities.PLA;
  const grams = directGrams && directGrams > 0 ? directGrams : volumeCm3 ? volumeCm3 * density : null;
  const timeLine =
    text.match(/;\s*estimated printing time(?:\s*\([^)]+\))?\s*[:=]\s*([^\n\r]+)/i) ??
    text.match(/estimated printing time(?:\s*\([^)]+\))?\s*[:=]\s*([^\n\r]+)/i);

  return {
    estimatedPrintMinutes: timeLine ? parseDurationMinutes(timeLine[1]) : null,
    estimatedGrams: grams == null ? null : Math.max(1, Math.round(grams))
  };
}

function parseDurationMinutes(value) {
  const days = Number(value.match(/(\d+(?:\.\d+)?)\s*d/i)?.[1] ?? 0);
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+(?:\.\d+)?)\s*s/i)?.[1] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + seconds / 60;
  return total > 0 ? Math.max(1, Math.round(total)) : null;
}

function numericMatch(text, regex) {
  const match = text.match(regex);
  return match ? Number(match[1]) : null;
}

async function findGcode(directory) {
  const files = await readdir(directory);
  const gcode = files.find((file) => /\.(gcode|gco|g)$/i.test(file));
  if (!gcode) throw new Error("Slicer did not produce a G-code file");
  return path.join(directory, gcode);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], cwd: options.cwd });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited with ${code}: ${stderr.trim()}`));
      }
    });
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 80 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function safeFileName(fileName) {
  return path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
}
