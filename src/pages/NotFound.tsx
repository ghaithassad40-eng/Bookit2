import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-center">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
