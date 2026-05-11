import { Worker } from "bullmq";
import IORedis from "ioredis";
import { sliceQueueName } from "../lib/queue-broker";
import { executeSliceJob } from "../services/slicing";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required to run the slice worker");
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null
});

new Worker(
  sliceQueueName,
  async (job) => {
    const { sliceJobId } = job.data as { sliceJobId: string };
    const result = await executeSliceJob(sliceJobId);
    return { acknowledged: true, sliceJobId, status: result.status };
  },
  { connection }
);
