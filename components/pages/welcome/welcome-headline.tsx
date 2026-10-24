import { welcomeCopy } from "@/lib/welcome/copy";

type WelcomeHeadlineProps = {
  className?: string;
};

export function WelcomeHeadline({ className }: WelcomeHeadlineProps) {
  return <h1 className={className}>{welcomeCopy.headline}</h1>;
}
