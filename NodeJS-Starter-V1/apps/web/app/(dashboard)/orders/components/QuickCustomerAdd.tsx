"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  contact_name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
});

type FormData = z.infer<typeof formSchema>;

interface QuickCustomerAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customer: { id: string; company_name: string }) => void;
}

export function QuickCustomerAdd({
  open,
  onOpenChange,
  onCustomerCreated,
}: QuickCustomerAddProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
    },
  });

  async function onSubmit(values: FormData) {
    setIsLoading(true);
    try {
      const response = await apiClient.post<{ id: string; company_name: string }>(
        "/api/customers",
        values
      );

      toast({
        title: "Customer Created",
        description: `${values.company_name} has been added to your customers.`,
      });

      onCustomerCreated(response);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to Create Customer",
        description: error.message || "Could not create customer. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Quick Add Customer</DialogTitle>
          <DialogDescription>
            Add a new customer with basic information. You can edit full details later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="company_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@acme.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder="+61 2 1234 5678"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Customer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
