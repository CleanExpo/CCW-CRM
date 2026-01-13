import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactSubmissionsTable } from "./components/ContactSubmissionsTable";
import { DemoRequestsTable } from "./components/DemoRequestsTable";
import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionsPage() {
  return (
    <div className="container py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Form Submissions</h1>
        <p className="text-muted-foreground">
          View and manage contact submissions and demo requests from the portal
        </p>
      </div>

      <Tabs defaultValue="contact" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="contact">Contact Submissions</TabsTrigger>
          <TabsTrigger value="demo">Demo Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="contact" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Form Submissions</CardTitle>
              <CardDescription>
                Messages from customers via the Contact Us form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableSkeleton />}>
                <ContactSubmissionsTable />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Demo Requests</CardTitle>
              <CardDescription>
                Demo requests from potential customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<TableSkeleton />}>
                <DemoRequestsTable />
              </Suspense>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
