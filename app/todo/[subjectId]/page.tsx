import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const TodoWorkspace = dynamic(() => import("@/components/todo/TodoWorkspace"), {
  loading: () => <AppRouteLoading />,
});

export default async function Page({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  return <TodoWorkspace initialSubjectId={decodeURIComponent(subjectId)} />;
}
