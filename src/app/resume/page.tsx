import { ResumeForm } from "@/components/ResumeForm";
import { getResume } from "@/lib/resume";

export const dynamic = "force-dynamic";

export default async function ResumePage() {
  const resume = await getResume();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">My resume</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Your main resume, used to score how well each job fits you.
        {resume && (
          <>
            {" "}
            Last updated {resume.updatedAt.slice(0, 10)}
            {resume.filename && <> from {resume.filename}</>}.
          </>
        )}
      </p>
      <ResumeForm text={resume?.text ?? ""} />
    </div>
  );
}
