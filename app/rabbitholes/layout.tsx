import { RabbitHoleProvider } from "@/lib/context/rabbithole-context";

export default function RabbitHoleLayout({ children }: { children: React.ReactNode }) {
  return <RabbitHoleProvider>{children}</RabbitHoleProvider>;
}
