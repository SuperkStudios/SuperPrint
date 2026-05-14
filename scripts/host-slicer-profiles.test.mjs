import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveFilamentProfile, materializeSlicerProfileSet } from "./host-slicer-profiles.mjs";

describe("host slicer profile resolution", () => {
  it("uses an exact selected-material filament profile when one exists", async () => {
    const tmp = await mkdir(path.join(os.tmpdir(), "superprint-profile-test-"), { recursive: true }).then(() => os.tmpdir());
    const profileDir = path.join(tmp, `profiles-${Date.now()}`);
    await mkdir(profileDir, { recursive: true });
    const pla = path.join(profileDir, "Elegoo PLA @ECC.json");
    const petg = path.join(profileDir, "Elegoo PETG @ECC.json");
    await writeFile(pla, "{}");
    await writeFile(petg, "{}");

    await expect(resolveFilamentProfile({ filament: pla, filamentDirectories: [profileDir] }, "PETG")).resolves.toBe(petg);
  });

  it("patches process settings by selected material", async () => {
    const tmp = path.join(os.tmpdir(), `superprint-materialize-${Date.now()}`);
    await mkdir(tmp, { recursive: true });
    const machine = path.join(tmp, "machine.json");
    const process = path.join(tmp, "process.json");
    const filament = path.join(tmp, "Elegoo PLA.json");
    await writeFile(machine, "{}");
    await writeFile(process, "{}");
    await writeFile(filament, "{}");

    const profiles = await materializeSlicerProfileSet({
      slicer: {
        machine,
        process,
        filament,
        patch: { process: { sparse_infill_density: "17%" } }
      },
      material: "TPU",
      tmpDir: tmp
    });

    const patched = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(profiles.process, "utf8")));
    expect(patched.sparse_infill_density).toBe("18%");
    expect(patched.outer_wall_speed).toBe("55");
  });
});
