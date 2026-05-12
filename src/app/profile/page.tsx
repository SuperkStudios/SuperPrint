import { redirect } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { ProfileForm } from "@/components/profile-form";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { getCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  if (!(await getBootstrapStatus()).isComplete) redirect("/setup");
  const session = await getCurrentSession();
  if (!session?.user.id) {
    return <AuthRequired title="Sign in to edit profile" copy="Your profile connects orders, uploads, and production updates." />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-primary">Customer profile</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-3 text-muted-foreground">Set your profile photo, username, and bio for your SuperPrint account.</p>
      <div className="mt-8">
        <ProfileForm user={session.user} />
      </div>
    </main>
  );
}
