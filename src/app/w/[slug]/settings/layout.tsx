import { PageContainer, PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getWorkspace } from "@/server/session";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await getWorkspace(slug);
  return (
    <PageContainer className="space-y-8">
      <PageHeader eyebrow={ctx.organization.name} title="Settings" />
      <div className="grid gap-8 md:grid-cols-[180px_minmax(0,1fr)]">
        <SettingsNav slug={slug} />
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
