type PageProps = {
  children: React.ReactNode;
};

export default function Page({ children }: PageProps) {
  return (
    <section className="h-full w-full bg-background text-primary rounded-tl-xl border flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      {children}
    </section>
  );
}
