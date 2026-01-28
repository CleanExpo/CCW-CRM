/**
 * Translation Management Dashboard
 *
 * Admin interface for managing product translations:
 * - View translation status for all products
 * - Bulk translate products to multiple languages
 * - Review AI-generated translations
 * - Approve/edit translations
 * - Translation coverage statistics
 */

import { Suspense } from "react";
import { TranslationDashboard } from "./components/TranslationDashboard";

export const metadata = {
  title: "Translation Management - CCW ERP",
  description: "Manage product translations across multiple languages",
};

export default function TranslationsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Translation Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage product translations across 10 languages with AI-powered translation and manual review workflow
        </p>
      </div>

      <Suspense fallback={<div>Loading translation dashboard...</div>}>
        <TranslationDashboard />
      </Suspense>
    </div>
  );
}
