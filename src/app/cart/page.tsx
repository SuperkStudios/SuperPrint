import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { CartView } from "@/components/cart-view";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import { getCurrentSession } from "@/lib/auth";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getOrCreateActiveCart, summarizeCart } from "@/services/cart";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to view cart" copy="Your cart is saved to your SuperPrint account." />;
  }
  await getOrCreateActiveCart(session.user.id);
  const summary = await summarizeCart(session.user.id);

  return (
    <PageShell>
      <PageSection>
        <PageHero eyebrow="Store cart" title="Cart" copy="Review everything before checkout." />
        <div className="mt-8">
          <CartView initialSummary={summary} />
        </div>
      </PageSection>
    </PageShell>
  );
}
