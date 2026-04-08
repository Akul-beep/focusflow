import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const SettingsPage = dynamic(() => import("@/components/pages/SettingsPage"), {
  loading: () => <AppRouteLoading />,
});

export default function Page() {
  return <SettingsPage />;
}
