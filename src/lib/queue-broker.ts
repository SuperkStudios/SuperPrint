import { Queue } from "bullmq";
import IORedis from "ioredis";

export const printQueueName = "superprint.prints";

let queue: Queue | null = null;

export function getPrintQueue() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!queue) {
    const connection = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null
    });
    queue = new Queue(printQueueName, { connection });
  }

  return queue;
}

export async function enqueuePrintJob(printJobId: string) {
  const printQueue = getPrintQueue();
  if (!printQueue) {
    return null;
  }

  return printQueue.add("print-job", { printJobId }, { attempts: 3, backoff: { type: "exponential", delay: 1000 } });
}
