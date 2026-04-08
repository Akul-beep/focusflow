import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const FocusPage = dynamic(() => import("@/components/pages/FocusPage"), {
  loading: () => <AppRouteLoading />,
});

export default function FocusMode() {
  return <FocusPage />;
}
