import { redirect } from "next/navigation";

export default async function OralConductPage({ params }: { params: Promise<{ id: string; paperId: string }> }) {
  const { id } = await params;
  redirect(`/results?examId=${id}`);
}
