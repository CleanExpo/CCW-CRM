"use client";

import { useState, useEffect } from "react";
import { Wrench, Plus, Calendar, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

interface ServiceRequest {
  id: string;
  customer_id: string;
  order_id: string | null;
  request_type: string;
  status: string;
  equipment_description: string;
  issue_description: string;
  photos: string[] | null;
  assigned_technician: string | null;
  scheduled_date: string | null;
  quote_amount: number | null;
  approved_amount: number | null;
  created_at: string;
  updated_at: string;
}

export default function ServicePage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);

  // New request form state
  const [requestType, setRequestType] = useState<string>("repair");
  const [equipmentDescription, setEquipmentDescription] = useState("");
  const [issueDescription, setIssueDescription] = useState("");

  useEffect(() => {
    loadServiceRequests();
  }, []);

  const loadServiceRequests = async () => {
    try {
      const response = await apiClient.get<{ items: ServiceRequest[] }>(
        "/api/service-requests?page_size=50"
      );
      setRequests(response.items || []);
    } catch (error) {
      console.error("Failed to load service requests:", error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!equipmentDescription.trim() || !issueDescription.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const requestData = {
        customer_id: "mock-customer-id", // Replace with actual authenticated customer
        request_type: requestType,
        equipment_description: equipmentDescription,
        issue_description: issueDescription,
        photos: null,
      };

      const response = await apiClient.post<ServiceRequest>(
        "/api/service-requests",
        requestData
      );

      toast.success("Service request submitted successfully! We'll contact you soon.");

      // Reset form
      setRequestType("repair");
      setEquipmentDescription("");
      setIssueDescription("");
      setShowNewRequestDialog(false);

      // Reload requests
      loadServiceRequests();
    } catch (error: any) {
      console.error("Service request submission failed:", error);
      toast.error(error.message || "Failed to submit service request");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      submitted: "bg-blue-100 text-blue-700",
      quoted: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      in_progress: "bg-purple-100 text-purple-700",
      completed: "bg-emerald-100 text-emerald-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return <Clock className="h-4 w-4" />;
      case "quoted":
        return <DollarSign className="h-4 w-4" />;
      case "approved":
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "in_progress":
        return <Wrench className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatRequestType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="container py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Service Portal
          </h1>
          <p className="text-muted-foreground">
            Submit service requests, track repairs, and manage workshop projects.
          </p>
        </div>

        <Dialog open={showNewRequestDialog} onOpenChange={setShowNewRequestDialog}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="h-5 w-5 mr-2" />
              New Service Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Submit Service Request</DialogTitle>
              <DialogDescription>
                Describe your equipment and the issue you're experiencing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="request-type">Request Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger id="request-type" className="mt-2">
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="installation">Installation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="equipment">Equipment Description</Label>
                <Textarea
                  id="equipment"
                  placeholder="e.g., 2019 Caterpillar 320 Excavator, Serial #ABC123"
                  value={equipmentDescription}
                  onChange={(e) => setEquipmentDescription(e.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="issue">Issue Description</Label>
                <Textarea
                  id="issue"
                  placeholder="Describe the problem, symptoms, or work needed..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="photos">Photos (Optional)</Label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-2"
                  disabled
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Photo upload feature coming soon
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowNewRequestDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitRequest} disabled={isLoading}>
                {isLoading ? "Submitting..." : "Submit Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList>
          <TabsTrigger value="requests">
            My Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* Service Requests Tab */}
        <TabsContent value="requests">
          {requests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((request) => (
                <Card key={request.id} className="p-4 hover:shadow-lg transition-shadow">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge className={getStatusColor(request.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(request.status)}
                            {request.status}
                          </span>
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatRequestType(request.request_type)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <Separator />

                    {/* Equipment */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Equipment
                      </p>
                      <p className="text-sm line-clamp-2">
                        {request.equipment_description}
                      </p>
                    </div>

                    {/* Issue */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Issue
                      </p>
                      <p className="text-sm line-clamp-3">
                        {request.issue_description}
                      </p>
                    </div>

                    {/* Technician */}
                    {request.assigned_technician && (
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <span>Assigned to {request.assigned_technician}</span>
                      </div>
                    )}

                    {/* Scheduled Date */}
                    {request.scheduled_date && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {new Date(request.scheduled_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {/* Quote */}
                    {request.quote_amount !== null && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm font-semibold">Quote:</span>
                        <span className="text-lg font-bold text-primary">
                          ${request.quote_amount.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Approved Amount */}
                    {request.approved_amount !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Approved:</span>
                        <span className="text-lg font-bold text-green-600">
                          ${request.approved_amount.toFixed(2)}
                        </span>
                      </div>
                    )}

                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Wrench className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No Service Requests Yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Submit your first service request to get started
                </p>
                <Button onClick={() => setShowNewRequestDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Service Request
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Project Timeline</h2>
            <p className="text-muted-foreground">
              Detailed timeline view with status updates and photos coming soon.
            </p>
            <Separator className="my-6" />
            <div className="space-y-4">
              {requests
                .filter((r) => r.status !== "submitted")
                .map((request) => (
                  <div key={request.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {getStatusIcon(request.status)}
                      </div>
                      <div className="flex-1 w-px bg-border mt-2" />
                    </div>
                    <div className="flex-1 pb-8">
                      <p className="font-semibold">
                        {formatRequestType(request.request_type)} -{" "}
                        {request.status}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.equipment_description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(request.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
