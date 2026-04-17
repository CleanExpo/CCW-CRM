'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { Plus, Edit, Trash2, MapPin, Building2, Store, Monitor } from 'lucide-react';
import { TerminalDialog } from './components/TerminalDialog';

// Form validation schema
const locationSchema = z.object({
  code: z
    .string()
    .min(1, 'Location code is required')
    .regex(/^[a-z_]+$/, 'Use lowercase letters and underscores only'),
  name: z.string().min(1, 'Location name is required'),
  location_type: z.enum(['physical', 'virtual'], {
    required_error: 'Please select a location type',
  }),
  address: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  postal_code: z.string().optional().or(z.literal('')),
  country: z.string().default('Australia'),
  timezone: z.string().default('Australia/Brisbane'),
  is_active: z.boolean().default(true),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface Location {
  id: string;
  code: string;
  name: string;
  location_type: 'physical' | 'virtual';
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface POSTerminal {
  id: string;
  terminal_id: string;
  location_code: string;
  terminal_type: string;
  is_active: boolean;
  merchant_id: string | null;
  last_ping_at: string | null;
}

export default function LocationsPage() {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [terminals, setTerminals] = useState<POSTerminal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
  const [selectedLocationForTerminals, setSelectedLocationForTerminals] = useState<string | null>(
    null
  );
  const [isTerminalDialogOpen, setIsTerminalDialogOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<POSTerminal | null>(null);
  const [deletingTerminal, setDeletingTerminal] = useState<POSTerminal | null>(null);

  // Initialize form
  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      code: '',
      name: '',
      location_type: 'physical',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Australia',
      timezone: 'Australia/Brisbane',
      is_active: true,
    },
  });

  // Load data on mount
  useEffect(() => {
    loadLocations();
    loadTerminals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocations() {
    try {
      const response = await apiClient.get<Location[]>('/api/pos/locations');
      setLocations(response || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load locations. Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function loadTerminals() {
    try {
      const response = await apiClient.get<POSTerminal[]>('/api/pos/terminals');
      setTerminals(response || []);
    } catch (error) {
      console.error('Failed to load terminals:', error);
    }
  }

  async function onSubmit(values: LocationFormData) {
    setIsLoading(true);

    try {
      if (editingLocation) {
        // Update existing location
        await apiClient.put(`/api/pos/locations/${editingLocation.id}`, values);
        toast({
          title: 'Success',
          description: `${values.name} updated successfully.`,
        });
      } else {
        // Create new location
        await apiClient.post('/api/pos/locations', values);
        toast({
          title: 'Success',
          description: `${values.name} created successfully.`,
        });
      }

      // Reload locations list
      loadLocations();

      // Close dialog and reset form
      setIsDialogOpen(false);
      setEditingLocation(null);
      form.reset();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save location. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingLocation) return;

    setIsLoading(true);

    try {
      await apiClient.delete(`/api/pos/locations/${deletingLocation.id}`);

      toast({
        title: 'Success',
        description: `${deletingLocation.name} deleted successfully.`,
      });

      // Reload locations list
      loadLocations();

      // Close dialog
      setIsDeleteDialogOpen(false);
      setDeletingLocation(null);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete location. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(location: Location) {
    setEditingLocation(location);
    form.reset({
      code: location.code,
      name: location.name,
      location_type: location.location_type as 'physical' | 'virtual',
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      postal_code: location.postal_code || '',
      country: location.country,
      timezone: location.timezone,
      is_active: location.is_active,
    });
    setIsDialogOpen(true);
  }

  function handleCreate() {
    setEditingLocation(null);
    form.reset({
      code: '',
      name: '',
      location_type: 'physical',
      address: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'Australia',
      timezone: 'Australia/Brisbane',
      is_active: true,
    });
    setIsDialogOpen(true);
  }

  function handleDeleteClick(location: Location) {
    setDeletingLocation(location);
    setIsDeleteDialogOpen(true);
  }

  // Get terminals for a specific location
  function getTerminalsForLocation(locationCode: string) {
    return terminals.filter((t) => t.location_code === locationCode);
  }

  // Get location type icon
  function getLocationIcon(type: string) {
    return type === 'physical' ? <Store className="h-4 w-4" /> : <Building2 className="h-4 w-4" />;
  }

  // Separate physical and virtual locations
  const physicalLocations = locations.filter((l) => l.location_type === 'physical');
  const virtualLocations = locations.filter((l) => l.location_type === 'virtual');

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Locations</h1>
          <p className="text-muted-foreground">Manage physical and virtual sales locations</p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </div>

      <Tabs defaultValue="physical" className="space-y-4">
        <TabsList>
          <TabsTrigger value="physical">
            Physical Locations ({physicalLocations.length})
          </TabsTrigger>
          <TabsTrigger value="virtual">Virtual Locations ({virtualLocations.length})</TabsTrigger>
          <TabsTrigger value="terminals">Terminals ({terminals.length})</TabsTrigger>
        </TabsList>

        {/* Physical Locations Tab */}
        <TabsContent value="physical" className="space-y-4">
          {physicalLocations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Store className="text-muted-foreground mx-auto h-12 w-12" />
                <p className="mt-4 text-lg font-medium">No physical locations found</p>
                <p className="text-muted-foreground">
                  Create your first physical location (store or warehouse)
                </p>
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Physical Location
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {physicalLocations.map((location) => {
                const locationTerminals = getTerminalsForLocation(location.code);
                const activeTerminals = locationTerminals.filter((t) => t.is_active);

                return (
                  <Card key={location.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="text-primary h-5 w-5" />
                          <div>
                            <CardTitle className="text-lg">{location.name}</CardTitle>
                            <CardDescription className="mt-1 text-xs">
                              {location.code}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={location.is_active ? 'default' : 'secondary'}>
                          {location.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Address */}
                      {location.address && (
                        <div className="text-sm">
                          <p className="font-medium">Address</p>
                          <p className="text-muted-foreground">
                            {location.address}
                            {location.city && `, ${location.city}`}
                            {location.state && `, ${location.state}`}
                            {location.postal_code && ` ${location.postal_code}`}
                          </p>
                        </div>
                      )}

                      {/* Terminals */}
                      <div className="text-sm">
                        <p className="font-medium">POS Terminals</p>
                        <p className="text-muted-foreground">
                          {activeTerminals.length} active / {locationTerminals.length} total
                        </p>
                        {locationTerminals.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {locationTerminals.slice(0, 3).map((terminal) => (
                              <div
                                key={terminal.id}
                                className="flex items-center justify-between text-xs"
                              >
                                <span>{terminal.terminal_id}</span>
                                <Badge
                                  variant={terminal.is_active ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {terminal.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                            ))}
                            {locationTerminals.length > 3 && (
                              <p className="text-muted-foreground text-xs">
                                +{locationTerminals.length - 3} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timezone */}
                      <div className="text-sm">
                        <p className="font-medium">Timezone</p>
                        <p className="text-muted-foreground">{location.timezone}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(location)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Virtual Locations Tab */}
        <TabsContent value="virtual" className="space-y-4">
          {virtualLocations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="text-muted-foreground mx-auto h-12 w-12" />
                <p className="mt-4 text-lg font-medium">No virtual locations found</p>
                <p className="text-muted-foreground">
                  Create virtual locations for online or phone sales
                </p>
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Virtual Location
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Virtual Locations</CardTitle>
                <CardDescription>Online and telephone sales channels</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Timezone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {virtualLocations.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getLocationIcon(location.location_type)}
                            {location.name}
                          </div>
                        </TableCell>
                        <TableCell>{location.timezone}</TableCell>
                        <TableCell>
                          <Badge variant={location.is_active ? 'default' : 'secondary'}>
                            {location.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(location)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(location)}
                            >
                              <Trash2 className="text-destructive h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Terminals Tab */}
        <TabsContent value="terminals" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>POS Terminals</CardTitle>
                  <CardDescription>Manage terminals across all locations</CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setEditingTerminal(null);
                    setIsTerminalDialogOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Terminal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {terminals.length === 0 ? (
                <div className="py-12 text-center">
                  <Monitor className="text-muted-foreground mx-auto h-12 w-12" />
                  <p className="mt-4 text-lg font-medium">No terminals found</p>
                  <p className="text-muted-foreground">Create your first POS terminal</p>
                  <Button
                    onClick={() => {
                      setEditingTerminal(null);
                      setIsTerminalDialogOpen(true);
                    }}
                    className="mt-4"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Terminal
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Terminal Code</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {terminals.map((terminal) => {
                      const location = locations.find((l) => l.code === terminal.location_code);
                      return (
                        <TableRow key={terminal.id}>
                          <TableCell className="font-medium">{terminal.terminal_id}</TableCell>
                          <TableCell>{location ? location.name : terminal.location_code}</TableCell>
                          <TableCell className="capitalize">{terminal.terminal_type}</TableCell>
                          <TableCell>{terminal.merchant_id || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={terminal.is_active ? 'default' : 'secondary'}>
                              {terminal.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingTerminal(terminal);
                                  setIsTerminalDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeletingTerminal(terminal)}
                              >
                                <Trash2 className="text-destructive h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
            <DialogDescription>
              {editingLocation ? 'Update location information' : 'Create a new sales location'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Code</FormLabel>
                      <FormControl>
                        <Input placeholder="brisbane" {...field} disabled={!!editingLocation} />
                      </FormControl>
                      <FormDescription>Lowercase letters and underscores only</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Brisbane Headquarters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="physical">
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4" />
                              Physical (Store/Warehouse)
                            </div>
                          </SelectItem>
                          <SelectItem value="virtual">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              Virtual (Online/Phone)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === 'true')}
                        defaultValue={field.value ? 'true' : 'false'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="true">Active</SelectItem>
                          <SelectItem value="false">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address fields - only for physical locations */}
              {form.watch('location_type') === 'physical' && (
                <>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="123 Main Street" {...field} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Brisbane" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Queensland">Queensland</SelectItem>
                              <SelectItem value="New South Wales">New South Wales</SelectItem>
                              <SelectItem value="Victoria">Victoria</SelectItem>
                              <SelectItem value="South Australia">South Australia</SelectItem>
                              <SelectItem value="Western Australia">Western Australia</SelectItem>
                              <SelectItem value="Tasmania">Tasmania</SelectItem>
                              <SelectItem value="Northern Territory">Northern Territory</SelectItem>
                              <SelectItem value="Australian Capital Territory">
                                Australian Capital Territory
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="postal_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="4000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="Australia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timezone</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Australia/Brisbane">
                            Australia/Brisbane (AEST)
                          </SelectItem>
                          <SelectItem value="Australia/Sydney">Australia/Sydney (AEDT)</SelectItem>
                          <SelectItem value="Australia/Melbourne">
                            Australia/Melbourne (AEDT)
                          </SelectItem>
                          <SelectItem value="Australia/Adelaide">
                            Australia/Adelaide (ACDT)
                          </SelectItem>
                          <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                          <SelectItem value="Australia/Darwin">Australia/Darwin (ACST)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingLocation(null);
                    form.reset();
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading
                    ? 'Saving...'
                    : editingLocation
                      ? 'Update Location'
                      : 'Create Location'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingLocation?.name} ({deletingLocation?.code}). This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingLocation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminal Dialog */}
      <TerminalDialog
        open={isTerminalDialogOpen}
        onOpenChange={setIsTerminalDialogOpen}
        mode={editingTerminal ? 'edit' : 'create'}
        terminal={editingTerminal || undefined}
        locations={locations}
        onSuccess={() => {
          loadLocations();
          loadTerminals();
        }}
      />

      {/* Terminal Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingTerminal}
        onOpenChange={(open) => !open && setDeletingTerminal(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Terminal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate terminal {deletingTerminal?.terminal_id}. It will no longer
              accept transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingTerminal(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingTerminal) return;
                try {
                  await apiClient.delete(`/api/pos/terminals/${deletingTerminal.id}`);
                  toast({
                    title: 'Success',
                    description: 'Terminal deleted successfully',
                  });
                  setDeletingTerminal(null);
                  loadLocations();
                  loadTerminals();
                } catch (error: unknown) {
                  toast({
                    title: 'Error',
                    description:
                      error instanceof Error ? error.message : 'Failed to delete terminal',
                    variant: 'destructive',
                  });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
