import dynamic from "next/dynamic";
import { Suspense } from "react";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const TodayPage = dynamic(() => import("@/components/pages/TodayPage"), {
  loading: () => <AppRouteLoading />,
});

export default function Page() {
  return (
    <Suspense fallback={<AppRouteLoading />}>
      <TodayPage />
    </Suspense>
  );
}
