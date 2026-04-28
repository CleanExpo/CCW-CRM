"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamApi, type TeamMemberRole } from "@/lib/api/team";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Validation schema
const formSchema = z.object({
  email: z.string().email("Valid email address required"),
  full_name: z.string().max(255, "Maximum 255 characters").optional(),
  role: z.enum(["owner", "admin", "member", "billing"]).default("member"),
});

type FormData = z.infer<typeof formSchema>;

interface InviteTeamMemberFormProps {
  onSuccess?: (credentials?: {
    email: string;
    temporary_password: string;
    role: TeamMemberRole;
    must_change_password: boolean;
  }) => void;
  onCancel?: () => void;
}

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  billing: "CFO/Finance Staff",
};

export function InviteTeamMemberForm({ onSuccess, onCancel }: InviteTeamMemberFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      full_name: "",
      role: "member",
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);

    try {
      const result = await teamApi.invite({
        email: values.email,
        full_name: values.full_name || undefined,
        role: values.role as TeamMemberRole,
      });

      toast({
        title: "Invitation Sent",
        description: `Sent invitation to ${values.email}`,
      });

      onSuccess?.(result.credentials);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send invitation";
      toast({
        variant: "destructive",
        title: "Invitation Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email *</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>We'll send them an invitation email</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Smith" {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="member">Member (Recommended)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="billing">{ROLE_LABELS.billing}</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Member = read/write access, Admin = full operational access, CFO/Finance Staff = billing only
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitation
          </Button>
        </div>
      </form>
    </Form>
  );
}
