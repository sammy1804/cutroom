import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { ContactSheet } from "@/components/auth/contact-sheet";
import { getSession } from "@/server/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10 sm:py-8">
        <Link href="/" className="w-fit">
          <Logo className="text-[15px]" />
        </Link>
        <main className="flex flex-1 items-center py-12">
          <div className="w-full max-w-[360px]">{children}</div>
        </main>
        <p className="label-meta">Phase 1 · Foundation build</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l bg-sidebar lg:block">
        <ContactSheet />
      </aside>
    </div>
  );
}
