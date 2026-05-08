'use client'
import { JobReel } from "../job-queue";

export default function JobQueuesPage() {
  // Assuming you want to use the logic from useJobQueue in this page
  // Adjust import as necessary
  // import useJobQueue from "../job-queue"; (path may vary)
  // Get queue state from the custom hook
  // Note: if you want actual live-updating values, see comment below

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const useJobQueue = require("../job-queue").default as typeof import("../job-queue").default;
  const {
    latestJobIndex,
    runnningJobIndex,
    currentlyRunningJob,
    sampleJobs,
  } = useJobQueue();

  // For displaying the latest scheduled job (assume you want to show by index)
  const latestScheduledJob =
    sampleJobs[latestJobIndex.current] ?? null;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background px-8 py-16">
      <h1 className="text-3xl font-bold mb-8">Job Queue</h1>
      <section>
        <div>
          {JSON.stringify(latestScheduledJob)}
        </div>
      </section>
      <section className="w-full max-w-5xl">
        <JobReel
          jobs={sampleJobs.slice(latestJobIndex.current, runnningJobIndex.current)}
          runningJob={sampleJobs[runnningJobIndex.current] ?? null}
          latestJob={sampleJobs[latestJobIndex.current] ?? null}
        />
      </section>
    </main>
  );
}