import { notFound } from "next/navigation";
import { deleteApplication, updateApplication } from "@/app/actions";
import { ApplicationForm } from "@/components/ApplicationForm";
import { DeleteButton } from "@/components/DeleteButton";
import { Documents } from "@/components/Documents";
import { MatchPanel } from "@/components/MatchPanel";
import { getApplication, listDocuments } from "@/lib/db";
import { getResume } from "@/lib/resume";

export const dynamic = "force-dynamic";

export default async function EditApplication({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [app, resume, documents] = await Promise.all([getApplication(Number(id)), getResume(), listDocuments(Number(id))]);
  if (!app) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{app.company}</h1>
            <p className="text-sm text-zinc-500">
              Added {app.created_at.slice(0, 10)} · Updated {app.updated_at.slice(0, 10)}
            </p>
          </div>
          <DeleteButton action={deleteApplication.bind(null, app.id)} />
        </div>
        <ApplicationForm action={updateApplication.bind(null, app.id)} initial={app} submitLabel="Save changes" />
      </div>
      <MatchPanel
        applicationId={app.id}
        match={app.match_json ? JSON.parse(app.match_json) : null}
        matchedAt={app.matched_at}
        hasResume={Boolean(resume)}
        hasDescription={Boolean(app.description)}
        resumeUpdatedAt={resume?.updatedAt ?? null}
      />
      <Documents applicationId={app.id} documents={documents} />
    </div>
  );
}
