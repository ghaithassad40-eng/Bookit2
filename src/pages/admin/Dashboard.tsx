import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { CalendarCheck, DollarSign, TrendingUp, Users } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { BusinessRow, BusinessConfigRow } from "@/lib/database.types";
import { useBookings } from "@/hooks/useBookings";
import { useServices } from "@/hooks/useServices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { defaultCurrencyForCountry } from "@/lib/location";

interface Ctx {
  business: BusinessRow;
  config: BusinessConfigRow;
}

export default function Dashboard() {
  const { business } = useOutletContext<Ctx>();
  const { data: bookings, isLoading } = useBookings({ businessId: business.id, limit: 500 });
  const { data: services } = useServices(business.id, { onlyActive: false });
  // Revenue is reported in the business's primary currency, derived from
  // its country (KW → KWD, SA → SAR, AE → AED, …). Without this, the
  // stats fell back to formatCurrency's USD default and a Kuwait vendor
  // saw 'US$0' for their weekly revenue.
  const reportingCurrency = defaultCurrencyForCountry(business.country);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const priceFor = (svcId: string) =>
      services?.find((s) => s.id === svcId)?.price ?? 0;

    const todayCount = bookings?.filter((b) => new Date(b.created_at) >= today).length ?? 0;
    const totalRevenue = bookings?.reduce((sum, b) => sum + priceFor(b.service_id), 0) ?? 0;
    const weeklyRevenue =
      bookings
        ?.filter((b) => new Date(b.created_at) >= sevenDaysAgo)
        .reduce((sum, b) => sum + priceFor(b.service_id), 0) ?? 0;
    const customers = new Set(bookings?.map((b) => (b.customer_email || b.customer_phone || b.customer_name)));

    // 14-day trend
    const trend: { day: string; bookings: number; revenue: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const day = bookings?.filter(
        (b) => new Date(b.created_at) >= d && new Date(b.created_at) < next,
      ) ?? [];
      trend.push({
        day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        bookings: day.length,
        revenue: day.reduce((sum, b) => sum + priceFor(b.service_id), 0),
      });
    }

    return { todayCount, totalRevenue, weeklyRevenue, customers: customers.size, trend };
  }, [bookings, services]);

  const upcoming = useMemo(
    () =>
      bookings
        ?.filter((b) => b.status === "confirmed")
        .slice(0, 6) ?? [],
    [bookings],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            What's happening at {business.name} today.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Today's bookings" value={stats.todayCount.toString()} icon={CalendarCheck} loading={isLoading} />
        <Stat label="7-day revenue" value={formatCurrency(stats.weeklyRevenue, reportingCurrency)} icon={TrendingUp} loading={isLoading} />
        <Stat label="Lifetime revenue" value={formatCurrency(stats.totalRevenue, reportingCurrency)} icon={DollarSign} loading={isLoading} />
        <Stat label="Unique customers" value={stats.customers.toString()} icon={Users} loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking trend (14d)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend}>
                <defs>
                  <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }}
                />
                <Area type="monotone" dataKey="bookings" stroke="hsl(var(--accent))" fill="url(#g)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming sessions</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : upcoming.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No upcoming bookings yet.
            </p>
          ) : (
            upcoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <div className="font-medium">{b.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{b.booking_reference}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {formatDate(b.created_at)} · {formatTime(b.created_at)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">
            {loading ? <Skeleton className="h-7 w-20" /> : value}
          </div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
