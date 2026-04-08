import dynamic from "next/dynamic";
import { AppRouteLoading } from "@/components/AppRouteLoading";

const ExamDetailPage = dynamic(() => import("@/components/pages/ExamDetailPage"), {
  loading: () => <AppRouteLoading />,
});

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamDetailPage examId={decodeURIComponent(id)} />;
}
