export type PrinterStartCommand = {
  printJobId: string;
  gcodeLocalPath: string;
};

export type PrinterControlAdapter = {
  startPrint: (command: PrinterStartCommand) => Promise<{
    acknowledged: boolean;
    mode: string;
    message: string;
  }>;
};

export class ManualNoopPrinterControlAdapter implements PrinterControlAdapter {
  async startPrint(_command: PrinterStartCommand) {
    return {
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged start command; no printer API was called."
    };
  }
}
