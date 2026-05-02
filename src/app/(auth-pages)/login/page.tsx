import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { AlreadyLoggedIn } from "./already-logged-in";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    return <AlreadyLoggedIn email={user.email} />;
  }

  return (
    <Suspense fallback={<p className="text-center text-sm text-zinc-500">Laden …</p>}>
      <LoginForm />
    </Suspense>
  );
}
