import { fontCommissioner } from "@/config/fonts";

const commissioner = fontCommissioner;


export default function PrometheusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${commissioner.variable}`}>
    {children}</div>;
}