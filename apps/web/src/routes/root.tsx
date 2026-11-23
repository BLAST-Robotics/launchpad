import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { BrandMark, Button, Spinner } from "../components/ui";
import { meQueryOptions } from "../lib/api";
import { signOut } from "../lib/auth";

export function RootLayout() {
  return (
    <div className="min-h-dvh bg-page text-primary">
      <Outlet />
    </div>
  );
}

export function AuthedLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQueryOptions);

  async function handleSignOut() {
    await signOut();
    queryClient.clear();
    await navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur">
        <span aria-hidden="true" className="fire-bar" />
        <div className="border-b border-subtle">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link to="/dashboard" aria-label="LaunchPad home">
              <BrandMark subtitle="Blast Robotics · 10989" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              {me?.profileComplete ? (
                <>
                  <Link
                    to="/waivers"
                    className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-offset-2 sm:inline-block"
                    activeProps={{ className: "bg-subtle/60" }}
                  >
                    Waiver
                  </Link>
                  <Link
                    to="/core-values"
                    className="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-offset-2 sm:inline-block"
                    activeProps={{ className: "bg-subtle/60" }}
                  >
                    Core values
                  </Link>
                </>
              ) : null}
              {me?.effectivePermissions.includes("admin:manage") ? (
                <Link
                  to="/admin"
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2"
                  activeProps={{ className: "bg-accent-soft" }}
                >
                  Admin
                </Link>
              ) : null}
              {me ? (
                <span className="hidden max-w-[16rem] truncate text-sm text-muted md:inline">
                  {me.email}
                </span>
              ) : null}
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function PendingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 text-sm text-muted">
      <Spinner />
      <span>{label}…</span>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="fire-text text-5xl font-black tracking-tight">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">That page does not exist.</h1>
      <Link
        to="/"
        className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-strong"
      >
        Back to LaunchPad
      </Link>
    </div>
  );
}
