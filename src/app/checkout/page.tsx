import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { CheckoutForm } from "@/components/checkout-form";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { prisma } from "@/lib/prisma";
import { summarizeCart } from "@/services/cart";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to checkout" copy="Checkout is attached to your SuperPrint account." />;
  }
  const [summary, user] = await Promise.all([
    summarizeCart(session.user.id),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  ]);
  if (!summary.items.length) redirect("/cart");

  return (
    <PageShell>
      <PageSection>
        <PageHero eyebrow="Secure checkout" title="Checkout" copy="Confirm delivery and pay without leaving SuperPrint." />
        <div className="mt-8">
          <CheckoutForm
            initialSummary={summary}
            customerEmail={user.email}
            savedAddress={{
              name: user.shippingName ?? user.name,
              street1: user.shippingStreet1 ?? "",
              street2: user.shippingStreet2 ?? "",
              city: user.shippingCity ?? "",
              state: user.shippingState ?? "CO",
              zip: user.shippingZip ?? "",
              country: user.shippingCountry ?? "US",
              phone: user.shippingPhone ?? "",
              email: user.email
            }}
          />
        </div>
      </PageSection>
    </PageShell>
  );
}
