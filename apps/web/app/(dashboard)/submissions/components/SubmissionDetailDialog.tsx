"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { Clock, Mail, Phone, Building2, User, Calendar } from "lucide-react";

interface Note {
  id: string;
  note_type: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DemoRequest {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  product_interest: string | null;
  preferred_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SubmissionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  submissionType: "contact" | "demo";
  onStatusUpdate?: () => void;
}

const contactStatusOptions = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-800" },
  { value: "read", label: "Read", color: "bg-yellow-100 text-yellow-800" },
  { value: "responded", label: "Responded", color: "bg-green-100 text-green-800" },
  { value: "closed", label: "Closed", color: "bg-gray-100 text-gray-800" },
];

const demoStatusOptions = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "scheduled", label: "Scheduled", color: "bg-blue-100 text-blue-800" },
  { value: "completed", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

export function SubmissionDetailDialog({
  open,
  onOpenChange,
  submissionId,
  submissionType,
  onStatusUpdate,
}: SubmissionDetailDialogProps) {
  const [submission, setSubmission] = useState<ContactSubmission | DemoRequest | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);

  const statusOptions = submissionType === "contact" ? contactStatusOptions : demoStatusOptions;

  useEffect(() => {
    if (open && submissionId) {
      loadSubmission();
      loadNotes();
    }
  }, [open, submissionId]);

  async function loadSubmission() {
    try {
      const endpoint = submissionType === "contact"
        ? `/api/contact-submissions/${submissionId}`
        : `/api/demo-requests/${submissionId}`;
      const data = await apiClient.get<ContactSubmission | DemoRequest>(endpoint);
      setSubmission(data);
    } catch (error: any) {
      toast.error("Failed to load submission details");
    }
  }

  async function loadNotes() {
    try {
      const data = await apiClient.get<Note[]>(`/api/submissions/${submissionType}/${submissionId}/notes`);
      setNotes(data);
    } catch (error: any) {
      toast.error("Failed to load notes");
    }
  }

  async function handleStatusChange(newStatus: string) {
    setIsLoading(true);
    try {
      const endpoint = submissionType === "contact"
        ? `/api/contact-submissions/${submissionId}/status`
        : `/api/demo-requests/${submissionId}/status`;

      await apiClient.patch(endpoint, { status: newStatus });
      toast.success("Status updated successfully");
      await loadSubmission();
      await loadNotes();
      onStatusUpdate?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;

    setIsAddingNote(true);
    try {
      await apiClient.post(`/api/submissions/${submissionType}/${submissionId}/notes`, {
        content: newNote,
        created_by: "admin",
      });
      setNewNote("");
      toast.success("Note added successfully");
      await loadNotes();
    } catch (error: any) {
      toast.error(error.message || "Failed to add note");
    } finally {
      setIsAddingNote(false);
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status);
    return option?.color || "bg-gray-100 text-gray-800";
  };

  const isContactSubmission = (sub: any): sub is ContactSubmission => {
    return submissionType === "contact";
  };

  if (!submission) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {isContactSubmission(submission) ? "Contact Submission" : "Demo Request"}
            </span>
            <Select
              value={submission.status}
              onValueChange={handleStatusChange}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            <Badge className={getStatusBadgeColor(submission.status)}>
              {submission.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Submitted {format(new Date(submission.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Contact/Company Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {isContactSubmission(submission) ? "Contact Information" : "Company Information"}
              </h3>

              <div className="grid gap-3">
                {!isContactSubmission(submission) && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{submission.company_name}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{isContactSubmission(submission) ? submission.name : submission.contact_name}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${submission.email}`} className="text-blue-600 hover:underline">
                    {submission.email}
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{submission.phone || "Not provided"}</span>
                </div>

                {!isContactSubmission(submission) && submission.preferred_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Preferred: {format(new Date(submission.preferred_date), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Message/Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {isContactSubmission(submission) ? "Message" : "Request Details"}
              </h3>

              {isContactSubmission(submission) && submission.subject && (
                <div>
                  <span className="text-sm font-medium">Subject: </span>
                  <span>{submission.subject}</span>
                </div>
              )}

              <div className="rounded-md bg-muted p-4">
                <p className="whitespace-pre-wrap text-sm">
                  {isContactSubmission(submission) ? submission.message : submission.notes}
                </p>
              </div>

              {!isContactSubmission(submission) && submission.product_interest && (
                <div>
                  <span className="text-sm font-medium">Product Interest: </span>
                  <span>{submission.product_interest}</span>
                </div>
              )}

              {isContactSubmission(submission) && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Source: </span>
                  <Badge variant="outline">{submission.source}</Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Notes & Activity */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Notes & Activity</h3>

              {/* Add Note Form */}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isAddingNote}
                  size="sm"
                >
                  {isAddingNote ? "Adding..." : "Add Note"}
                </Button>
              </div>

              <Separator />

              {/* Notes Timeline */}
              <div className="space-y-3">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="flex gap-3">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {note.created_by || "System"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {note.note_type === "status_change" && (
                            <Badge variant="outline" className="text-xs">
                              Status Change
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
