"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { Location, POSTerminal } from "../../types";

const terminalSchema = z.object({
  terminal_code: z.string().min(1, "Terminal code is required"),
  location_id: z.string().min(1, "Location is required"),
  terminal_type: z.enum(["physical", "virtual"]),
  provider: z.string().optional(),
  serial_number: z.string().optional(),
  is_active: z.boolean(),
});

type TerminalFormData = z.infer<typeof terminalSchema>;

interface TerminalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  terminal?: POSTerminal;
  locations: Location[];
  onSuccess: () => void;
}

export function TerminalDialog({
  open,
  onOpenChange,
  mode,
  terminal,
  locations,
  onSuccess,
}: TerminalDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TerminalFormData>({
    resolver: zodResolver(terminalSchema),
    defaultValues: {
      terminal_code: "",
      location_id: "",
      terminal_type: "physical",
      provider: "",
      serial_number: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && terminal) {
      form.reset({
        terminal_code: terminal.terminal_id,
        location_id: terminal.location_code,
        terminal_type: terminal.terminal_type as "physical" | "virtual",
        provider: "",
        serial_number: "",
        is_active: terminal.is_active,
      });
    } else {
      form.reset({
        terminal_code: "",
        location_id: "",
        terminal_type: "physical",
        provider: "",
        serial_number: "",
        is_active: true,
      });
    }
  }, [mode, terminal, form]);

  async function onSubmit(data: TerminalFormData) {
    setIsLoading(true);
    try {
      const payload = {
        terminal_id: data.terminal_code,
        location_code: data.location_id,
        terminal_type: data.terminal_type,
        merchant_id: data.provider || null,
        is_active: data.is_active,
      };

      const url =
        mode === "create"
          ? "/api/pos/terminals"
          : `/api/pos/terminals/${terminal?.id}`;

      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save terminal");
      }

      toast({
        title: "Success",
        description: `Terminal ${mode === "create" ? "created" : "updated"} successfully`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save terminal",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Terminal" : "Edit Terminal"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a new POS terminal to a location"
              : "Update terminal configuration"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="terminal_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terminal Code</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="TERM-001"
                      {...field}
                      disabled={mode === "edit"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.code}>
                          {location.name} ({location.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="terminal_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terminal Type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="physical">Physical</SelectItem>
                      <SelectItem value="virtual">Virtual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Tyro, Square, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serial_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="SN-123456" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Terminal can accept transactions
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
                {isLoading
                  ? "Saving..."
                  : mode === "create"
                  ? "Create"
                  : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
