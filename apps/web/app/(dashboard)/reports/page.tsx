'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesKpiDashboard } from './components/SalesKpiDashboard';
import { InventoryHealthDashboard } from './components/InventoryHealthDashboard';
import { BarChart3, Package } from 'lucide-react';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Equipment Sales &amp; Inventory KPIs
          </h1>
          <p className="text-muted-foreground">
            Cleaning equipment sales performance and inventory health analytics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sales KPIs
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventory Health
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <SalesKpiDashboard />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryHealthDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
