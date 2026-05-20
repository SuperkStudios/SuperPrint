import { describe, expect, it } from "vitest";
import {
  isInternalLabelPrintCommand,
  stripLeadingNullsFromTsplBuffer,
  superprintBleA42BtPrintCommand
} from "@/services/label-printer";

describe("label-printer", () => {
  it("recognizes SuperPrint's built-in BLE command", () => {
    expect(isInternalLabelPrintCommand(superprintBleA42BtPrintCommand)).toBe(true);
    expect(isInternalLabelPrintCommand("lpr")).toBe(false);
  });

  it("strips Arrvel driver padding before the TSPL SIZE command", () => {
    const tspl = stripLeadingNullsFromTsplBuffer(Buffer.concat([
      Buffer.from([0, 0, 0]),
      Buffer.from("SIZE 100 mm,150 mm\r\nCLS\r\nPRINT 1,1\r\n")
    ]));

    expect(tspl.toString("utf8")).toBe("SIZE 100 mm,150 mm\r\nCLS\r\nPRINT 1,1\r\n");
  });

  it("rejects filter output that is not TSPL", () => {
    expect(() => stripLeadingNullsFromTsplBuffer(Buffer.from([0, 1, 2]))).toThrow(/TSPL SIZE/);
  });
});
