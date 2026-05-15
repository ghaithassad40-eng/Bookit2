import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from "react-router-dom";
import Home from "@/pages/Home";
import Legal from "@/pages/Legal";
import NotFound from "@/pages/NotFound";
import Health from "@/pages/Health";
import { CustomerLayout } from "@/components/layout/CustomerLayout";
import Landing from "@/pages/customer/Landing";
import Book from "@/pages/customer/Book";
import Confirmation from "@/pages/customer/Confirmation";
import PaymentCallback from "@/pages/customer/PaymentCallback";
import PaymentFailed from "@/pages/customer/PaymentFailed";
import MyFatoorahMock from "@/pages/customer/MyFatoorahMock";
import Account from "@/pages/customer/Account";
import Login from "@/pages/admin/Login";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Bookings from "@/pages/admin/Bookings";
import CalendarPage from "@/pages/admin/Calendar";
import Services from "@/pages/admin/Services";
import Equipment from "@/pages/admin/Equipment";
import Staff from "@/pages/admin/Staff";
import Slots from "@/pages/admin/Slots";
import Payouts from "@/pages/admin/Payouts";
import Settings from "@/pages/admin/Settings";
import { PlatformAdminLayout } from "@/components/layout/PlatformAdminLayout";
import PlatformBusinesses from "@/pages/platform/PlatformBusinesses";
import { ExternalRedirect, getHostMode } from "@/lib/host";

/**
 * Two route trees, chosen by host (see src/lib/host.ts).
 *
 *   MAIN host (bk-it.ai / localhost:5173)
 *     Customer site + vendor admin workspaces. Any hit on /admin/platform
 *     is bounced cross-origin to the admin console.
 *
 *   ADMIN host (admin.bk-it.ai / localhost:5174)
 *     Platform operations console only. Customer + vendor paths bounce
 *     cross-origin back to the main host so the operator surface stays
 *     tight and there's never any accidental drift between the two.
 *
 * Both trees keep /admin/login because login happens on whichever host
 * the user reached first — the post-auth handler in Login.tsx decides
 * which host owns the user's destination by role.
 */

// ─── Main host (customer + vendor) ──────────────────────────────────────────

const mainRoutes: RouteObject[] = [
  { path: "/", element: <Home /> },
  { path: "/privacy", element: <Legal kind="privacy" /> },
  { path: "/terms", element: <Legal kind="terms" /> },
  // Deployment smoke-test page. Run after each deploy to verify every
  // backend integration is wired. Public on purpose; no secrets leak.
  { path: "/health", element: <Health /> },
  // MyFatoorah-style hosted page (only used when running without real
  // MyFatoorah credentials — see src/lib/myfatoorah.ts).
  { path: "/payment/myfatoorah-mock", element: <MyFatoorahMock /> },
  // Customer self-service hub — orders, profile, saved payment methods.
  // Lives on the main host (not per-business) since customers cross
  // businesses. The page itself bounces anonymous visitors back to /.
  { path: "/account", element: <Account /> },
  {
    path: "/business/:slug",
    element: <CustomerLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: "book", element: <Book /> },
      { path: "confirmation", element: <Confirmation /> },
      { path: "payment/callback", element: <PaymentCallback /> },
      { path: "payment/failed", element: <PaymentFailed /> },
    ],
  },
  { path: "/admin", element: <Navigate to="/admin/login" replace /> },
  { path: "/admin/login", element: <Login /> },
  // Platform console doesn't live on the main host — bounce to admin.
  // Catches /admin/platform and any nested path (e.g. /admin/platform/audit
  // once that ships) without enumerating each.
  {
    path: "/admin/platform/*",
    element: <ExternalRedirect target="admin" to="/admin/platform" />,
  },
  {
    path: "/admin/:slug",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "bookings", element: <Bookings /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "services", element: <Services /> },
      { path: "equipment", element: <Equipment /> },
      { path: "staff", element: <Staff /> },
      { path: "slots", element: <Slots /> },
      { path: "payouts", element: <Payouts /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "*", element: <NotFound /> },
];

// ─── Admin host (platform operations console) ───────────────────────────────

const adminRoutes: RouteObject[] = [
  // Root of admin.bk-it.ai goes straight to the console (or login if signed
  // out — the PlatformAdminLayout guard handles the redirect).
  { path: "/", element: <Navigate to="/admin/platform" replace /> },
  { path: "/admin", element: <Navigate to="/admin/platform" replace /> },
  { path: "/admin/login", element: <Login /> },
  {
    path: "/admin/platform",
    element: <PlatformAdminLayout />,
    children: [{ index: true, element: <PlatformBusinesses /> }],
  },
  // Anything customer- or vendor-shaped that wanders onto the admin host
  // bounces back to the main site. We don't render those pages here at all.
  {
    path: "/business/*",
    element: <ExternalRedirect target="main" to="/" />,
  },
  {
    path: "/admin/:slug/*",
    element: <ExternalRedirect target="main" to="/admin/login" />,
  },
  { path: "/privacy", element: <ExternalRedirect target="main" to="/privacy" /> },
  { path: "/terms", element: <ExternalRedirect target="main" to="/terms" /> },
  { path: "*", element: <NotFound /> },
];

export const router = createBrowserRouter(
  getHostMode() === "admin" ? adminRoutes : mainRoutes,
);
