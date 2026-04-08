import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const TodoWorkspace = dynamic(() => import("@/components/todo/TodoWorkspace"), {
  loading: () => <AppRouteLoading />,
});

export default function Page() {
  return <TodoWorkspace />;
}
