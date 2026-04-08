import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const DashboardPage = dynamic(() => import("@/components/pages/DashboardPage"), {
  loading: () => <AppRouteLoading />,
});

export default function DashboardRoutePage() {
  return <DashboardPage />;
}
