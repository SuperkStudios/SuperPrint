import { Worker } from "bullmq";
import IORedis from "ioredis";
import { resolveSlicedFileLifecycle } from "../domain/orca-slicer";
import { sliceQueueName } from "../lib/queue-broker";
import { prisma } from "../lib/prisma";

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
    const sliceJob = await prisma.sliceJob.findUniqueOrThrow({ where: { id: sliceJobId } });
    const runningStatus = resolveSlicedFileLifecycle(sliceJob.status, "start");

    await prisma.sliceJob.update({
      where: { id: sliceJobId },
      data: { status: runningStatus, startedAt: new Date() }
    });

    // TODO: Invoke OrcaSlicer CLI here and write outputs to the mounted sliced volume.
    // This is intentionally not connected to print start or printer control.
    return { acknowledged: true, sliceJobId };
  },
  { connection }
);
