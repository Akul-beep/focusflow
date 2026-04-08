import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const ExamsListPage = dynamic(() => import("@/components/pages/ExamsListPage"), {
  loading: () => <AppRouteLoading />,
});

export default function Page() {
  return <ExamsListPage />;
}
