import { planPrintAnomalyResponse, type PrintAnomalyType } from "@/domain/print-failure-response";
import { ManualNoopPrinterControlAdapter, type PrinterControlAdapter } from "@/domain/printer-control";
import { prisma } from "@/lib/prisma";
import { failPrintJob, pausePrintJob } from "./queue";
import { sendOperationsAlert } from "./notifications";

export async function handlePrintAnomaly(input: {
  printJobId: string;
  printerId: string;
  type: PrintAnomalyType;
  confidence: number;
  adapter?: PrinterControlAdapter;
}) {
  const adapter = input.adapter ?? new ManualNoopPrinterControlAdapter();
  const response = planPrintAnomalyResponse(input);

  if (response.printerAction === "stop") {
    await adapter.stopPrint?.(input.printJobId);
    await adapter.cooldown?.(input.printerId);
    await failPrintJob(input.printJobId, `${response.notificationTitle} at ${Math.round(input.confidence * 100)}% confidence`);
  } else if (response.printerAction === "pause") {
    await adapter.pausePrint?.(input.printJobId);
    await pausePrintJob(input.printJobId);
  }

  await prisma.printer.update({
    where: { id: input.printerId },
    data: {
      status: response.printerStatus,
      healthDescription: `${response.notificationTitle}: ${Math.round(input.confidence * 100)}% confidence`
    }
  });

  const task = response.maintenanceTask
    ? await prisma.maintenanceTask.create({
        data: {
          ...response.maintenanceTask,
          dueAt: new Date()
        }
      })
    : null;

  await sendOperationsAlert({
    title: response.notificationTitle,
    message: task
      ? `${response.notificationTitle}. Printer stopped and maintenance task created: ${task.title}.`
      : `${response.notificationTitle}. Review live camera before continuing unattended printing.`,
    severity: response.severity,
    printerId: input.printerId,
    printJobId: input.printJobId
  });

  return { response, task };
}
