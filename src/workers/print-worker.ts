import { Worker } from "bullmq";
import IORedis from "ioredis";
import { printQueueName } from "../lib/queue-broker";
import { prepareNextQueuedJob } from "../services/queue";

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
    // TODO: Real printer agent dispatch belongs behind SuperNode; this worker only prepares persisted assignments.
    const prepared = await prepareNextQueuedJob();
    return { acknowledged: true, requestedPrintJobId: printJobId, preparedPrintJobId: prepared?.id ?? null };
  },
  { connection }
);
