import { NextResponse } from "next/server";
import { z } from "zod";
import { createNodeSecret, hashNodeSecret } from "@/domain/supernode-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  nodeId: z.string().trim().min(3),
  displayName: z.string().trim().min(1),
  printerId: z.string().trim().optional().nullable()
});

export async function POST(request: Request) {
  const registrationToken = process.env.SUPERNODE_REGISTRATION_TOKEN;
  if (!registrationToken || request.headers.get("x-supernode-registration-token") !== registrationToken) {
    return NextResponse.json({ error: "SuperNode registration token required" }, { status: 403 });
  }

  const body = schema.parse(await request.json());
  const secret = createNodeSecret(body.nodeId);
  const secretHash = await hashNodeSecret(secret);
  const node = await prisma.superNode.upsert({
    where: { nodeId: body.nodeId },
    update: {
      displayName: body.displayName,
      secretHash,
      printerId: body.printerId ?? null,
      heartbeatStatus: "UNKNOWN"
    },
    create: {
      nodeId: body.nodeId,
      displayName: body.displayName,
      secretHash,
      printerId: body.printerId ?? null
    }
  });

  return NextResponse.json({
    nodeId: node.nodeId,
    nodeSecret: secret
  });
}
