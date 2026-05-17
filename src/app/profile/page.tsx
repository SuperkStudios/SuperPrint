import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { ProfileForm } from "@/components/profile-form";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to edit profile" copy="Your profile connects orders, uploads, and production updates." />;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <PageShell>
      <PageSection className="max-w-3xl">
      <PageHero eyebrow="Customer profile" title="Profile" copy="Set your profile photo, username, and bio for your SuperPrint account." />
      <div className="mt-8">
        <ProfileForm user={user} />
      </div>
      </PageSection>
    </PageShell>
  );
}
