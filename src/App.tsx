import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "@/router";
import { useAutoReleaseScheduler } from "@/hooks/usePayouts";
import { I18nProvider } from "@/hooks/useI18n";
import { RegionProvider } from "@/hooks/useRegion";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AutoReleaseBackground() {
  useAutoReleaseScheduler();
  return null;
}

export default function App() {
  return (
    <I18nProvider>
      <RegionProvider>
        <QueryClientProvider client={queryClient}>
          <AutoReleaseBackground />
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            richColors
            toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
          />
        </QueryClientProvider>
      </RegionProvider>
    </I18nProvider>
  );
}
