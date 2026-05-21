import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/http";
import { addCartItem, getOrCreateActiveCart, removeCartItem, summarizeCart, updateCartItem } from "@/services/cart";

const addSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().optional(),
  selectedFilamentMaterialId: z.string().optional().nullable(),
  selectedFilamentMaterialIds: z.array(z.string()).optional(),
  selectedMaterial: z.string().optional().nullable(),
  selectedColor: z.string().optional().nullable(),
  selectedColors: z.array(z.string()).optional()
});

const updateSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(0)
});

const removeSchema = z.object({
  itemId: z.string()
});

export async function GET() {
  const { session, response } = await requireCustomer();
  if (response) return response;
  await getOrCreateActiveCart(session!.user.id);
  return NextResponse.json(await summarizeCart(session!.user.id));
}

export async function POST(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  try {
    const body = addSchema.parse(await request.json());
    return NextResponse.json(await addCartItem({ userId: session!.user.id, ...body }), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add item to cart." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  try {
    const body = updateSchema.parse(await request.json());
    return NextResponse.json(await updateCartItem({ userId: session!.user.id, ...body }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update cart." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const { session, response } = await requireCustomer();
  if (response) return response;
  try {
    const body = removeSchema.parse(await request.json());
    return NextResponse.json(await removeCartItem({ userId: session!.user.id, ...body }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove item." }, { status: 400 });
  }
}
