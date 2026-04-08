import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const TodoWorkspace = dynamic(() => import("@/components/todo/TodoWorkspace"), {
  loading: () => <AppRouteLoading />,
});

export default async function Page({
  params,
}: {
  params: Promise<{ subjectId: string; noteId: string }>;
}) {
  const { subjectId, noteId } = await params;
  return (
    <TodoWorkspace
      key={noteId}
      initialSubjectId={decodeURIComponent(subjectId)}
      initialNoteId={decodeURIComponent(noteId)}
    />
  );
}
