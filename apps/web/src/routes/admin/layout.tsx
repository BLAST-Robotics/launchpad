import { Link, Outlet } from "@tanstack/react-router";

const TABS = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/members", label: "Members", exact: false },
  { to: "/admin/roster", label: "Roster", exact: false },
  { to: "/admin/core-values", label: "Core values", exact: false },
  { to: "/admin/activity", label: "Activity", exact: false },
] as const;

/**
 * Frame for every admin screen. The router redirects non-admins away before this renders,
 * but that is only a convenience: every `/api/admin` route enforces the role itself.
 */
export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Admin</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Team records</h1>
      </div>

      <nav aria-label="Admin sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 border-b border-subtle">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <Link
                to={tab.to}
                activeOptions={{ exact: tab.exact }}
                className="-mb-px block border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                activeProps={{ className: "!border-accent !text-primary" }}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet />
    </div>
  );
}
