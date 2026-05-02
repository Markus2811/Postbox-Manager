import { AuthProjectHint } from "./auth-project-hint";

export default function AuthPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        {children}
        <AuthProjectHint />
      </div>
    </div>
  );
}
