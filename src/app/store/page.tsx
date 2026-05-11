import { ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StorePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const products = await prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">Approved products</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Print-ready catalog</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Products here are already printable, priced, and ready to enter the live manufacturing queue after checkout.
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {products.length ? products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <div className="mb-4 flex h-36 items-center justify-center rounded bg-zinc-950 text-white">
                <img src={product.imageUrl} alt="" className="h-full w-full rounded object-cover" />
              </div>
              <CardTitle>{product.name}</CardTitle>
              <CardDescription>{product.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{money(product.priceCents)}</p>
                <p className="text-sm text-muted-foreground">{product.estimatedPrintMinutes} min · {product.defaultMaterial}</p>
              </div>
              <Button size="sm" asChild>
                <a href="/login">
                <ShoppingCart className="size-4" />
                Checkout
                </a>
              </Button>
            </CardContent>
          </Card>
        )) : (
          <Card className="md:col-span-3">
            <CardContent className="p-8 text-center text-muted-foreground">
              No approved products are active yet. Check back after the next catalog release.
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
