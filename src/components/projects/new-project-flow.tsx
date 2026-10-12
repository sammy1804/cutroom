"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { CampaignFields, emptyCampaign, type CampaignDraft } from "@/components/campaigns/campaign-fields";
import { PIPELINE_STAGES } from "@/components/campaigns/pipeline";
import { firstErrors, zodFieldErrors } from "@/components/field";
import { ProjectSwatch } from "@/components/status";
import { Button } from "@/components/ui/button";
import { createProjectAction } from "@/server/actions/projects";
import { CHANNELS, campaignSchema, projectSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { ProjectFields, emptyProject, type ProjectDraft } from "./project-fields";

const STEPS = [
  { id: "project", label: "Project", detail: "Who it's for" },
  { id: "campaign", label: "First campaign", detail: "Optional" },
] as const;

export function NewProjectFlow({ slug, workspaceName }: { slug: string; workspaceName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [project, setProject] = useState<ProjectDraft>(emptyProject);
  const [campaign, setCampaign] = useState<CampaignDraft>(emptyCampaign);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const base = `/w/${slug}`;

  function next() {
    const parsed = projectSchema.safeParse(project);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues));
    setErrors({});
    setStep(1);
  }

  function submit(withCampaign: boolean) {
    if (withCampaign) {
      const parsed = campaignSchema.safeParse(campaign);
      if (!parsed.success) return setErrors(zodFieldErrors(parsed.error.issues));
    }
    setErrors({});
    startTransition(async () => {
      const result = await createProjectAction(slug, project, withCampaign ? campaign : undefined);
      if (!result.ok) {
        const fieldErrors = firstErrors(result.fieldErrors);
        setErrors(fieldErrors);
        if (fieldErrors.name || fieldErrors.websiteUrl) setStep(0);
        toast.error(result.message);
        return;
      }
      toast.success(`${project.name.trim()} created`);
      const { id, campaignId } = result.data;
      router.push(campaignId ? `${base}/projects/${id}/campaigns/${campaignId}` : `${base}/projects/${id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex h-12 items-center justify-between border-b px-4 sm:px-6">
        <span className="label-meta truncate">{workspaceName} / New project</span>
        <Button variant="ghost" size="icon-sm" asChild aria-label="Cancel">
          <Link href={`${base}/projects`}>
            <X />
          </Link>
        </Button>
      </div>

      <div className="mx-auto grid w-full max-w-[1100px] flex-1 gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[180px_minmax(0,1fr)_300px] lg:py-14">
        <ol className="flex gap-6 lg:flex-col lg:gap-5">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "tabular mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
                  i < step && "border-success/50 bg-success/15 text-success",
                  i === step && "border-tally bg-tally/15 text-foreground",
                  i > step && "text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              <span>
                <span className={cn("block text-sm", i === step ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
                <span className="block text-xs text-muted-foreground">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <section className="min-w-0 space-y-8">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{step === 0 ? "New project" : "Plan the first campaign"}</h1>
            <p className="max-w-[60ch] text-sm text-muted-foreground">
              {step === 0
                ? "Set up the brand or product. You can change all of this later."
                : "Sketch what you're making first. Skip this if you'd rather set it up later."}
            </p>
          </div>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 0) next();
              else submit(true);
            }}
            className="space-y-8"
          >
            {step === 0 ? (
              <ProjectFields value={project} onChange={setProject} errors={errors} />
            ) : (
              <CampaignFields value={campaign} onChange={setCampaign} errors={errors} />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
              {step === 0 ? (
                <Button variant="ghost" asChild>
                  <Link href={`${base}/projects`}>Cancel</Link>
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setStep(0)} disabled={pending}>
                  <ArrowLeft data-icon="inline-start" /> Back
                </Button>
              )}
              <div className="flex gap-2">
                {step === 1 && (
                  <Button type="button" variant="outline" onClick={() => submit(false)} disabled={pending}>
                    Skip for now
                  </Button>
                )}
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  {step === 0 ? "Continue" : "Create project"}
                  {step === 0 && <ArrowRight data-icon="inline-end" />}
                </Button>
              </div>
            </div>
          </form>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-14 space-y-3">
            <span className="label-meta">Preview</span>
            <div className="relative overflow-hidden rounded-lg bg-card shadow-card p-4">
              <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, ${project.color}, transparent 70%)` }} />
              <div className="flex items-center gap-2">
                <ProjectSwatch color={project.color} />
                <span className="truncate text-sm font-medium">{project.name.trim() || "Untitled project"}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                {project.description.trim() || "No description"}
              </p>
              {step === 1 && campaign.name.trim() && (
                <div className="mt-4 space-y-2 border-t pt-3">
                  <p className="text-xs font-medium">{campaign.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {campaign.channels.map((c) => CHANNELS.find((x) => x.id === c)?.label).join(" · ") || "No channels"}
                  </p>
                  <div className="flex gap-1">
                    {campaign.aspectRatios.map((r) => (
                      <span key={r} className="rounded border px-1.5 py-0.5 text-[13px] text-muted-foreground">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <ul className="space-y-1.5 pt-2">
              {PIPELINE_STAGES.map((stage) => (
                <li key={stage.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={stage.phase === 1 ? "text-foreground" : undefined}>{stage.label}</span>
                  <span className="font-mono text-[11px]">{stage.phase === 1 ? "Now" : `Phase ${stage.phase}`}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
