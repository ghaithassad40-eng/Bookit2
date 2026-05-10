import { createBrowserRouter, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import { CustomerLayout } from "@/components/layout/CustomerLayout";
import Landing from "@/pages/customer/Landing";
import Book from "@/pages/customer/Book";
import Confirmation from "@/pages/customer/Confirmation";
import PaymentCallback from "@/pages/customer/PaymentCallback";
import PaymentFailed from "@/pages/customer/PaymentFailed";
import MyFatoorahMock from "@/pages/customer/MyFatoorahMock";
import Login from "@/pages/admin/Login";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import Bookings from "@/pages/admin/Bookings";
import Services from "@/pages/admin/Services";
import Staff from "@/pages/admin/Staff";
import Slots from "@/pages/admin/Slots";
import Settings from "@/pages/admin/Settings";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  // MyFatoorah-style hosted page (only used when running without real
  // MyFatoorah credentials — see src/lib/myfatoorah.ts).
  { path: "/payment/myfatoorah-mock", element: <MyFatoorahMock /> },
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
  {
    path: "/admin/:slug",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "bookings", element: <Bookings /> },
      { path: "services", element: <Services /> },
      { path: "staff", element: <Staff /> },
      { path: "slots", element: <Slots /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  { path: "*", element: <NotFound /> },
]);
