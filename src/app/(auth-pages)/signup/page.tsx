import { AlreadyLoggedIn } from "../login/already-logged-in";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    return <AlreadyLoggedIn email={user.email} />;
  }

  return (
    <Suspense fallback={<p className="text-center text-sm text-zinc-500">Laden …</p>}>
      <SignupForm />
    </Suspense>
  );
}
