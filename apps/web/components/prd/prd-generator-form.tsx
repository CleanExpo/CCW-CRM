"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";

const formSchema = z.object({
  requirements: z
    .string()
    .min(50, "Requirements must be at least 50 characters")
    .max(10000, "Requirements must be less than 10,000 characters"),
  targetUsers: z.string().optional(),
  timeline: z.string().optional(),
  teamSize: z.string().optional(),
  technicalConstraints: z.string().optional(),
});

export type PRDGenerationRequest = {
  requirements: string;
  context?: {
    target_users?: string;
    timeline?: string;
    team_size?: string;
    technical_constraints?: string;
  };
};

interface PRDGeneratorFormProps {
  onSubmit: (data: PRDGenerationRequest) => Promise<void>;
  isGenerating: boolean;
}

export function PRDGeneratorForm({ onSubmit, isGenerating }: PRDGeneratorFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requirements: "",
      targetUsers: "",
      timeline: "",
      teamSize: "",
      technicalConstraints: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    const request: PRDGenerationRequest = {
      requirements: values.requirements,
      context: {
        target_users: values.targetUsers || undefined,
        timeline: values.timeline || undefined,
        team_size: values.teamSize || undefined,
        technical_constraints: values.technicalConstraints || undefined,
      },
    };

    await onSubmit(request);
  };

  const characterCount = form.watch("requirements")?.length || 0;
  const isValid = characterCount >= 50 && characterCount <= 10000;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Requirements</CardTitle>
        <CardDescription>
          Describe your project requirements in plain English. The more detail you provide, the better the results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Main Requirements */}
            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Example: I need a customer portal where users can view their orders, track shipments, and download invoices. The portal should integrate with our existing ERP system and support role-based access control..."
                      className="min-h-[200px] resize-y"
                      {...field}
                      disabled={isGenerating}
                    />
                  </FormControl>
                  <FormDescription>
                    <span className={characterCount < 50 ? "text-destructive" : isValid ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                      {characterCount} / 10,000 characters {characterCount < 50 && `(${50 - characterCount} more needed)`}
                    </span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Context Fields */}
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="targetUsers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Users (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Sales team, customers, administrators"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Who will use this feature?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeline (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 3 months, Q2 2026"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Expected delivery timeline
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teamSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Size (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., 2 developers, 1 designer"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Available team resources
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="technicalConstraints"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technical Constraints (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Must use React, PostgreSQL"
                        {...field}
                        disabled={isGenerating}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Tech stack or limitations
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={isGenerating || !isValid}
              className="w-full md:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PRD...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate PRD
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
