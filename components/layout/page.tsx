type PageProps = {
  children: React.ReactNode;
};

export default function Page({ children }: PageProps) {
  return (
    <section className="relative h-[calc(100dvh-1rem)]  w-full bg-background text-primary rounded-tl-xl inset-shadow-xs flex flex-col items-center justify-center gap-4 border-l-1 border-t-1 border-border">
      {children}
    </section>
  );
}
