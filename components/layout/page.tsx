type PageProps = {
  children: React.ReactNode;
  transparentBackground?: boolean;
};

export default function Page({ children, transparentBackground }: PageProps) {
  return (
    <section
      className={`
        relative
        h-[calc(100dvh-1rem)] w-full
        ${transparentBackground ? "" : "bg-background"}
        text-primary
        sm:rounded-tl-xl sm:inset-shadow-xs
        flex flex-col items-center justify-center gap-4
        sm:border-l-1 sm:border-t-1 sm:border-border`}
    >
      {children}
    </section>
  );
}
