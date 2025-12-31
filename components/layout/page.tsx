type PageProps = {
  children: React.ReactNode;
  transparentBackground?: boolean;
};

export default function Page({ children, transparentBackground }: PageProps) {
  return (
    <section
      className={`
        relative
        h-dvh md:h-[calc(100dvh-1rem)] w-full
        ${transparentBackground ? "" : "bg-background"}
        text-primary
        md:rounded-tl-xl md:inset-shadow-xs
        flex flex-col items-center justify-center gap-4
        md:border-l-1 md:border-t-1 md:border-border`}
    >
      {children}
    </section>
  );
}
