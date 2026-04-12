'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

const formSchema = z.object({
  customer_name: z.string().min(2, 'Customer name required'),
  customer_email: z.string().email('Valid email required'),
  description: z.string().min(10, 'Add a brief description'),
  estimated_value: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface FirstQuoteStepProps {
  onComplete: (data?: Record<string, unknown>) => void;
  onBack: () => void;
  canGoBack: boolean;
}

export function FirstQuoteStep({ onComplete, onBack }: FirstQuoteStepProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [useAI, setUseAI] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customer_name: '',
      customer_email: '',
      description: '',
      estimated_value: '',
    },
  });

  async function onSubmit(values: FormData) {
    setIsCreating(true);
    try {
      const quote = await apiClient
        .post<{ id: string; quote_number: string }>('/api/quotes', {
          title: values.description.slice(0, 80),
          customer_name: values.customer_name,
          customer_email: values.customer_email,
          notes: values.description,
          estimated_value: values.estimated_value ? parseFloat(values.estimated_value) : undefined,
          use_ai: useAI,
        })
        .catch(() => undefined);
      onComplete({ quote, useAI });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Create your first quote to see how the platform works. You can add line items and send it
          to customers later.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="customer_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Restoration" {...field} disabled={isCreating} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="customer_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Email *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="contact@acme.com"
                    {...field}
                    disabled={isCreating}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Description *</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of what this quote is for..."
                    className="min-h-[100px]"
                    {...field}
                    disabled={isCreating}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimated_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Value (Optional)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="5000" {...field} disabled={isCreating} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="bg-accent/50 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="text-primary mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <h4 className="mb-1 font-medium">AI-Powered Quote Generation</h4>
                <p className="text-muted-foreground mb-3 text-sm">
                  Let AI suggest products and pricing based on your description (Professional plan
                  and above)
                </p>
                <Button
                  type="button"
                  variant={useAI ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseAI(!useAI)}
                  disabled={isCreating}
                >
                  {useAI ? 'AI Enabled' : 'Enable AI Suggestions'}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack} disabled={isCreating}>
              Back
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Quote & Finish
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
