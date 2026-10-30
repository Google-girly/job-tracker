import { createApplication } from "@/app/actions";
import { ApplicationForm } from "@/components/ApplicationForm";

export default function NewApplication() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold">Add application</h1>
      <ApplicationForm action={createApplication} submitLabel="Add application" />
    </div>
  );
}
