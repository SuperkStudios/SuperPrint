import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBootstrapStatus } from "@/lib/bootstrap";

export async function GET() {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json({ products });
}
