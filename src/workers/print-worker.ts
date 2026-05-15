import { Worker } from "bullmq";
import IORedis from "ioredis";
import { printQueueName } from "../lib/queue-broker";
import { prepareNextQueuedJob, startAssignedQueuedJobOnPrinter } from "../services/queue";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to run the print worker");
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

new Worker(
  printQueueName,
  async (job) => {
    const { printJobId } = job.data as { printJobId: string };
    const prepared = await prepareNextQueuedJob();
    const started = prepared?.printerId ? await startAssignedQueuedJobOnPrinter(prepared.id) : null;
    return {
      acknowledged: true,
      requestedPrintJobId: printJobId,
      preparedPrintJobId: prepared?.id ?? null,
      startedPrintJobId: started?.status === "PRINTING" ? started.id : null
    };
  },
  { connection }
);
