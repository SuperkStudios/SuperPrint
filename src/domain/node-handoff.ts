export function acknowledgeJobReadyOnNode(
  job: { id: string; status: string; printerId: string | null },
  node: { nodeId: string; printerId: string | null; localJobPath: string },
  readyOnNodeAt = new Date()
) {
  if (job.status !== "QUEUED" || !job.printerId) {
    throw new Error("Only queued assigned jobs can become ready on node");
  }
  if (node.printerId !== job.printerId) {
    throw new Error("Node is not assigned to this printer");
  }
  return {
    status: "READY_ON_NODE" as const,
    readyOnNodeId: node.nodeId,
    nodeLocalJobPath: node.localJobPath,
    readyOnNodeAt
  };
}
