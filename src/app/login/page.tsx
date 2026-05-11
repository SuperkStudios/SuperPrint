import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBootstrapStatus } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
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
    </main>
  );
}
