import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { PageShell } from "@/components/cyber-page";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  return (
    <PageShell className="flex items-start justify-center">
      <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use the owner or staff account created during first-run setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      </div>
    </PageShell>
  );
}
