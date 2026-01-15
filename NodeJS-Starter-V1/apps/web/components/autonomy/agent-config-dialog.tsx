'use client';

/**
 * Agent Configuration Dialog Component
 *
 * Modal dialog for editing agent autonomy configuration.
 * Includes autonomy level, confidence thresholds, rate limits, and toggles.
 */

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { getAgentConfig, updateAgentConfig } from '@/lib/api/autonomy';
import { AutonomyLevel, type AgentAutonomyConfig } from '@/lib/types/autonomy';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  autonomy_level: z.nativeEnum(AutonomyLevel),
  enabled: z.boolean(),

  // Confidence thresholds (0.0 - 1.0)
  min_confidence_low_risk: z.number().min(0).max(1),
  min_confidence_medium_risk: z.number().min(0).max(1),
  min_confidence_high_risk: z.number().min(0).max(1),

  // Auto-approval limits
  max_auto_approval_amount: z.number().min(0),
  max_auto_approval_quantity: z.number().min(0),

  // Rate limits
  max_actions_per_hour: z.number().min(1),
  max_actions_per_day: z.number().min(1),

  // Learning and notifications
  learning_enabled: z.boolean(),
  notify_on_execution: z.boolean(),
  notify_on_pending: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface AgentConfigDialogProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function AgentConfigDialog({
  agentId,
  agentName,
  isOpen,
  onClose,
  onSaved,
}: AgentConfigDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      autonomy_level: AutonomyLevel.ADVISORY,
      enabled: true,
      min_confidence_low_risk: 0.70,
      min_confidence_medium_risk: 0.85,
      min_confidence_high_risk: 0.95,
      max_auto_approval_amount: 1000,
      max_auto_approval_quantity: 100,
      max_actions_per_hour: 50,
      max_actions_per_day: 500,
      learning_enabled: true,
      notify_on_execution: false,
      notify_on_pending: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, agentId]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const config = await getAgentConfig(agentId);

      // Update form with loaded config
      form.reset({
        autonomy_level: config.autonomy_level,
        enabled: config.enabled,
        min_confidence_low_risk: config.min_confidence_low_risk,
        min_confidence_medium_risk: config.min_confidence_medium_risk,
        min_confidence_high_risk: config.min_confidence_high_risk,
        max_auto_approval_amount: config.max_auto_approval_amount,
        max_auto_approval_quantity: config.max_auto_approval_quantity,
        max_actions_per_hour: config.max_actions_per_hour,
        max_actions_per_day: config.max_actions_per_day,
        learning_enabled: config.learning_enabled,
        notify_on_execution: config.notify_on_execution,
        notify_on_pending: config.notify_on_pending,
      });
    } catch (error) {
      console.error('Failed to load config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent configuration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSaving(true);
      await updateAgentConfig(agentId, values);

      toast({
        title: 'Success',
        description: 'Agent configuration updated successfully',
      });

      onSaved();
    } catch (error) {
      console.error('Failed to update config:', error);
      toast({
        title: 'Error',
        description: 'Failed to update agent configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {agentName}</DialogTitle>
          <DialogDescription>
            Adjust autonomy level, confidence thresholds, and rate limits for this agent.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
                  <TabsTrigger value="limits">Limits</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  {/* Enabled Toggle */}
                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Agent</FormLabel>
                          <FormDescription>
                            Allow this agent to make autonomous decisions
                          </FormDescription>
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

                  {/* Autonomy Level */}
                  <FormField
                    control={form.control}
                    name="autonomy_level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Autonomy Level</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select autonomy level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={AutonomyLevel.ADVISORY}>
                              Advisory - All decisions require approval
                            </SelectItem>
                            <SelectItem value={AutonomyLevel.SEMI_AUTONOMOUS}>
                              Semi-Autonomous - Auto-execute low risk decisions
                            </SelectItem>
                            <SelectItem value={AutonomyLevel.FULLY_AUTONOMOUS}>
                              Fully Autonomous - Auto-execute all decisions
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Controls how much autonomy the agent has
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Learning Toggle */}
                  <FormField
                    control={form.control}
                    name="learning_enabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Learning Enabled</FormLabel>
                          <FormDescription>
                            Allow agent to learn from feedback and adjust thresholds
                          </FormDescription>
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
                </TabsContent>

                <TabsContent value="thresholds" className="space-y-4 mt-4">
                  {/* Low Risk Threshold */}
                  <FormField
                    control={form.control}
                    name="min_confidence_low_risk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Low Risk Confidence - {(field.value * 100).toFixed(0)}%
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={[field.value * 100]}
                            onValueChange={([value]) => field.onChange(value / 100)}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum confidence to auto-execute low risk decisions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Medium Risk Threshold */}
                  <FormField
                    control={form.control}
                    name="min_confidence_medium_risk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Medium Risk Confidence - {(field.value * 100).toFixed(0)}%
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={[field.value * 100]}
                            onValueChange={([value]) => field.onChange(value / 100)}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum confidence to auto-execute medium risk decisions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* High Risk Threshold */}
                  <FormField
                    control={form.control}
                    name="min_confidence_high_risk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          High Risk Confidence - {(field.value * 100).toFixed(0)}%
                        </FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={[field.value * 100]}
                            onValueChange={([value]) => field.onChange(value / 100)}
                          />
                        </FormControl>
                        <FormDescription>
                          Minimum confidence to auto-execute high risk decisions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="limits" className="space-y-4 mt-4">
                  {/* Max Auto-Approval Amount */}
                  <FormField
                    control={form.control}
                    name="max_auto_approval_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Auto-Approval Amount ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum dollar value that can be auto-approved
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Auto-Approval Quantity */}
                  <FormField
                    control={form.control}
                    name="max_auto_approval_quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Auto-Approval Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum quantity that can be auto-approved
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Actions Per Hour */}
                  <FormField
                    control={form.control}
                    name="max_actions_per_hour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Actions Per Hour</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Rate limit for actions per hour
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Max Actions Per Day */}
                  <FormField
                    control={form.control}
                    name="max_actions_per_day"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Actions Per Day</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Rate limit for actions per day
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Notification Toggles */}
                  <FormField
                    control={form.control}
                    name="notify_on_execution"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Notify on Execution
                          </FormLabel>
                          <FormDescription>
                            Send notification when agent executes a decision
                          </FormDescription>
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

                  <FormField
                    control={form.control}
                    name="notify_on_pending"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Notify on Pending
                          </FormLabel>
                          <FormDescription>
                            Send notification when decision requires approval
                          </FormDescription>
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
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
