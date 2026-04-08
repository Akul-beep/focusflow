import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const AnalyticsPage = dynamic(() => import("@/components/pages/AnalyticsPage"), {
  loading: () => <AppRouteLoading />,
});

export default function Page() {
  return <AnalyticsPage />;
}
