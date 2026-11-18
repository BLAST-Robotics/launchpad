import type { MeResponse } from "@launchpad/shared";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { ApiError, meQueryOptions } from "./lib/api";
import { AdminActivityPage } from "./routes/admin/activity";
import { AdminLayout } from "./routes/admin/layout";
import { AdminMembersPage } from "./routes/admin/members";
import { AdminOverviewPage } from "./routes/admin/overview";
import { AdminRosterPage } from "./routes/admin/roster";
import { AuthErrorPage } from "./routes/auth-error";
import { CoreValuesPage } from "./routes/core-values";
import { DashboardPage } from "./routes/dashboard";
import { LoginPage } from "./routes/index";
import { AuthedLayout, NotFound, RootLayout } from "./routes/root";
import { WaiversDonePage, WaiversPage } from "./routes/waivers";
import { WelcomePage } from "./routes/welcome";

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

/** Pathless layout: everything under it requires a session. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authed",
  beforeLoad: async ({ context, location }) => {
    let me: MeResponse;
    try {
      me = await context.queryClient.ensureQueryData(meQueryOptions);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        throw redirect({ to: "/" });
      }
      throw error;
    }
    // Onboarding gate: until the profile step is done, every authed page is /welcome.
    const onWelcome = location.pathname === "/welcome";
    if (!me.profileComplete && !onWelcome) throw redirect({ to: "/welcome" });
    if (me.profileComplete && onWelcome) throw redirect({ to: "/dashboard" });
  },
  component: AuthedLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

const dashboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/dashboard",
  component: DashboardPage,
});

const waiversRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/waivers",
  component: WaiversPage,
});

const waiversDoneRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/waivers/done",
  component: WaiversDonePage,
});

const coreValuesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/core-values",
  component: CoreValuesPage,
});

const welcomeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/welcome",
  component: WelcomePage,
});

/**
 * Admin area. The redirect below is a convenience for people who type the URL; the real
 * boundary is the API, which answers 403 to every `/api/admin` call from a non-admin.
 */
const adminRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/admin",
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me.effectivePermissions.includes("admin:manage")) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const adminOverviewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/",
  component: AdminOverviewPage,
});

const adminMembersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/members",
  component: AdminMembersPage,
  validateSearch: (search: Record<string, unknown>) => ({
    role: ["pending", "student", "parent", "mentor", "admin"].includes(search.role as string)
      ? (search.role as "pending" | "student" | "parent" | "mentor" | "admin")
      : undefined,
  }),
});

const adminRosterRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/roster",
  component: AdminRosterPage,
  validateSearch: (search: Record<string, unknown>) => ({
    state: ["all", "claimed", "unclaimed"].includes(search.state as string)
      ? (search.state as "all" | "claimed" | "unclaimed")
      : undefined,
  }),
});

const adminActivityRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "/activity",
  component: AdminActivityPage,
});

const authErrorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/error",
  component: AuthErrorPage,
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  authedRoute.addChildren([
    dashboardRoute,
    welcomeRoute,
    waiversRoute,
    waiversDoneRoute,
    coreValuesRoute,
    adminRoute.addChildren([
      adminOverviewRoute,
      adminMembersRoute,
      adminRosterRoute,
      adminActivityRoute,
    ]),
  ]),
  authErrorRoute,
]);

export function createRouterInstance(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouterInstance>;
  }
}
