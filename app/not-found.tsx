import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">{`404`}</h1>
        <h2 className="mt-4 text-2xl">{`Page Not Found`}</h2>
        <p className="mt-4 text-muted-foreground">
          {`Sorry, we couldn't find the page you're looking for.`}
        </p>
        <Link
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          href="/"
        >
          {`Return Home`}
        </Link>
      </div>
    </div>
  );
}
