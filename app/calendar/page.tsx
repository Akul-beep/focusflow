import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const CalendarPage = dynamic(() => import("@/components/pages/CalendarPage"), {
  loading: () => <AppRouteLoading />,
});

export default function Page() {
  return <CalendarPage />;
}
