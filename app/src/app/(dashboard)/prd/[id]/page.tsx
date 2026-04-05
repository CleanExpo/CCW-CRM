import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRDDetailView } from "@/components/prd/prd-detail-view";
import { apiClient } from "@/lib/api/client";
import type { PRDDetail } from "@/types/prd";

export const metadata: Metadata = {
  title: "PRD Details | CCW ERP",
  description: "View generated Product Requirements Document",
};

async function getPRD(id: string) {
  try {
    const response = await apiClient.get<PRDDetail>(`/api/prd/${id}`);
    return response;
  } catch (error) {
    return null;
  }
}

export default async function PRDDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const prd = await getPRD(id);

  if (!prd) {
    notFound();
  }

  return (
    <div className="container max-w-7xl mx-auto py-8">
      <PRDDetailView prd={prd} />
    </div>
  );
}
