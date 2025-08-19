import { title, subtitle } from "@/components/primitives";

export default async function Chat({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="inline-block max-w-xl text-center justify-center">
        <span className={title()}>Welcome Chat ;)</span>
        <span className={subtitle()}>Chat ID: {chatId}</span>
      </div>
    </section>
  );
}
