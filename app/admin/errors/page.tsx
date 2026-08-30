import { ServerErrorLogDashboard } from "./_components/ServerErrorLogDashboard";

export const metadata = {
  title: "Server errors · Admin",
};

export default function AdminServerErrorsPage() {
  return <ServerErrorLogDashboard />;
}
