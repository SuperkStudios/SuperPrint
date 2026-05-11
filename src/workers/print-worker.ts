import { Worker } from "bullmq";
import IORedis from "ioredis";
import { printQueueName } from "@/lib/queue-broker";

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
    // TODO: Replace this stub with the real printer agent handshake.
    // The agent should own printer API credentials, internal IPs, telemetry polling, and G-code dispatch.
    console.log(`Printer agent placeholder received print job ${printJobId}`);
    return { acknowledged: true, printJobId };
  },
  { connection }
);
