import { AppNav } from "@/components/app-nav";

export function AppPageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav />
      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
              {description}
            </p>
          ) : null}
        </header>
        {children}
      </main>
    </div>
  );
}
