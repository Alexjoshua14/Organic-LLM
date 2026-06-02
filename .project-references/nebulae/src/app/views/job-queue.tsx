// Used for visualizing how my job queue code is working
// Will show logs of:
//    requests being sent
//    responses being recieved
//    functions activating
//
//   job queue - as component slide area with job component cards (title/function, metadata)
//   runnning jobs

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import z from "zod";

const JobSchema = z.object({
  function: z.string(),
  id: z.string().uuid(),
  priority: z.enum(["low", "medium", "high"]),
});

type Job = z.infer<typeof JobSchema>;

// Generate a sample queue of 10 jobs with varying priorities and functions
const sampleJobs: Job[] = [
  {
    function: "Image Processing",
    id: "27f08425-fc02-40e3-8208-f9d61ad13c39",
    priority: "high",
  },
  {
    function: "Data Sync",
    id: "bb2ee87e-4d0c-45be-8200-7237b0e663bd",
    priority: "medium",
  },
  {
    function: "Notification Dispatch",
    id: "54571d8d-0732-4184-9e1c-2baf96db651d",
    priority: "low",
  },
  {
    function: "Model Training",
    id: "35375282-bd22-4e61-8200-25234d3c7c98",
    priority: "high",
  },
  {
    function: "Log Aggregation",
    id: "831d7369-bcde-4b53-9f38-7a13743eed95",
    priority: "medium",
  },
  {
    function: "Insights Calculation",
    id: "d90d7bfa-c96b-40d1-af8a-4f6e7bad713b",
    priority: "low",
  },
  {
    function: "User Report Generation",
    id: "1248ccbc-4c4f-46d8-936a-b0826a5b0ac3",
    priority: "medium",
  },
  {
    function: "Realtime Metrics",
    id: "f7bdd126-8b85-430c-932d-5945e6ac0083",
    priority: "high",
  },
  {
    function: "Cache Invalidation",
    id: "e1639444-c42d-44d7-9047-3ffcca23b8e1",
    priority: "low",
  },
  {
    function: "Database Backup",
    id: "b866343f-b024-415f-9e04-fc959f3d5fc8",
    priority: "medium",
  },
];


export const ScheduledJob: React.FC<{ job: Job, position: number, active?: boolean }> = ({ job, position, active = false }) => {
  return (
    <Card
      className={`w-[150px] h-[200px] ${active ? 'bg-accent-aurora/80' : 'bg-accent-ember/60'}`}
    >
      <CardHeader>{job.function}</CardHeader>
      <CardContent>
        <p>{`Priority: ${job.priority}`}</p>
      </CardContent>
      <CardFooter>
        {`Position ${position}`}
      </CardFooter>
    </Card>
  );
};

export const JobReel = ({
  jobs,
  runningJob,
  latestJob,
}: {
  jobs: Job[];
  runningJob: Job | null;
  latestJob: Job | null;
}) => {
  return (
    <ScrollArea className="w-96 whitespace-nowrap">
      <div className="flex w-max space-x-4 p-4">
        {jobs.map((job, index) => (
          <ScheduledJob
            key={job.id}
            job={job}
            position={index}
            active={job.id === runningJob?.id}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};


export default function useJobQueue() {

  const latestJobIndex = useRef<number>(0)
  const runnningJobIndex = useRef<number>(4);

  const latestScheduledJob = useRef<Job>(
    sampleJobs[latestJobIndex.current]
  )

  const currentlyRunningJob = useRef<Job>(null)

  // Get user ID
  // Fetch job queue based on user (perhaps do single tenancy for now and skip getting userID)
  // Display jobs queu as reel/carousel of ScheduledJob components
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    let active = true;
    const fetchJobs = async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (!active) return;
      setJobs([]);
    };

    // TODO: HOOK THIS UP, commented out for simplicity
    // const interval = setInterval(fetchJobs, 5000);

    return () => {
      active = false;
      // clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true; // Add active flag

    const incrementNewJobIndex = async (duration: number = 5000) => {
      if (!active) return;
      await new Promise((resolve) => setTimeout(resolve, duration));

      if (latestJobIndex.current < runnningJobIndex.current) {
        latestJobIndex.current += 1;
        latestScheduledJob.current = sampleJobs[latestJobIndex.current];
      }
    }

    const incrementRunningJobIndex = async (duration: number = 5000) => {
      if (!active) return;
      await new Promise((resolve) => setTimeout(resolve, duration));

      if (latestJobIndex.current < sampleJobs.length - 1) {
        runnningJobIndex.current += 1;
        currentlyRunningJob.current = sampleJobs[runnningJobIndex.current];
      }
    }

    const initiateSequence = async () => {
      let newJobActive = true;
      let runningJobActive = true;

      const runNewJobUntilCap = async () => {
        while (
          newJobActive &&
          active &&
          latestJobIndex.current < sampleJobs.length - 1
        ) {
          await incrementNewJobIndex();
          if (!active) break;
        }
        newJobActive = false;
      };

      const runRunningJobUntilCap = async () => {
        while (
          runningJobActive &&
          active &&
          runnningJobIndex.current < sampleJobs.length - 1
        ) {
          await incrementRunningJobIndex();
          if (!active) break;
        }
        runningJobActive = false;
      };

      runNewJobUntilCap();
      runRunningJobUntilCap();
    }

    initiateSequence();

    return () => {
      active = false;
    };

  }, []);


  return {
    latestJobIndex,
    runnningJobIndex,
    currentlyRunningJob,
    sampleJobs
  }
}
