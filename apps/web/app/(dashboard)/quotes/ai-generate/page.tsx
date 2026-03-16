import { Metadata } from "next";
import { AIQuoteBuilder } from "@/components/ai/AIQuoteBuilder";

export const metadata: Metadata = {
  title: "AI Quote Generator | CCW ERP",
  description: "Generate quotes from natural language using AI",
};

export default function AIQuoteGeneratePage() {
  return (
    <div className="container max-w-4xl py-8">
      <AIQuoteBuilder />
    </div>
  );
}
