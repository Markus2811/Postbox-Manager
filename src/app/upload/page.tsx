import { UploadClient } from "@/app/upload/upload-client";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <UploadClient />
    </div>
  );
}
