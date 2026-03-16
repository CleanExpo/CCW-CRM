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
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api/client';
import { Plus, Edit, Trash2, Search, UserPlus } from 'lucide-react';

// Form validation schema
const staffSchema = z.object({
  staff_code: z
    .string()
    .min(1, 'Staff code is required')
    .regex(/^[A-Z]{2,3}-[A-Z]+$/, 'Format: QLD-JOHN or NSW-MARY'),
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  primary_location_code: z.string().min(1, 'Primary location is required'),
  is_active: z.boolean().default(true),
});

type StaffFormData = z.infer<typeof staffSchema>;

interface SalesStaff {
  id: string;
  staff_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  primary_location_code: string;
  can_sell_at_locations: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: string;
  code: string;
  name: string;
  location_type: string;
}

export default function SalesStaffPage() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<SalesStaff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<SalesStaff | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<SalesStaff | null>(null);

  // Initialize form
  const form = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      staff_code: '',
      full_name: '',
      email: '',
      phone: '',
      primary_location_code: '',
      is_active: true,
    },
  });

  // Load data on mount
  useEffect(() => {
    loadStaff();
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStaff() {
    try {
      const response = await apiClient.get<{ data: SalesStaff[] }>('/api/pos/staff');
      setStaff(response.data || []);
    } catch (error) {
      console.error('Failed to load sales staff:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sales staff. Please try again.',
        variant: 'destructive',
      });
    }
  }

  async function loadLocations() {
    try {
      const response = await apiClient.get<{ data: Location[] }>('/api/pos/locations');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  }

  async function onSubmit(values: StaffFormData) {
    setIsLoading(true);

    try {
      if (editingStaff) {
        // Update existing staff
        await apiClient.put(`/api/pos/staff/${editingStaff.id}`, values);
        toast({
          title: 'Success',
          description: `${values.full_name} updated successfully.`,
        });
      } else {
        // Create new staff
        await apiClient.post('/api/pos/staff', values);
        toast({
          title: 'Success',
          description: `${values.full_name} created successfully.`,
        });
      }

      // Reload staff list
      loadStaff();

      // Close dialog and reset form
      setIsDialogOpen(false);
      setEditingStaff(null);
      form.reset();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to save staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!deletingStaff) return;

    setIsLoading(true);

    try {
      await apiClient.delete(`/api/pos/staff/${deletingStaff.id}`);

      toast({
        title: 'Success',
        description: `${deletingStaff.full_name} deleted successfully.`,
      });

      // Reload staff list
      loadStaff();

      // Close dialog
      setIsDeleteDialogOpen(false);
      setDeletingStaff(null);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete staff member. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleEdit(staffMember: SalesStaff) {
    setEditingStaff(staffMember);
    form.reset({
      staff_code: staffMember.staff_code,
      full_name: staffMember.full_name,
      email: staffMember.email || '',
      phone: staffMember.phone || '',
      primary_location_code: staffMember.primary_location_code,
      is_active: staffMember.is_active,
    });
    setIsDialogOpen(true);
  }

  function handleCreate() {
    setEditingStaff(null);
    form.reset({
      staff_code: '',
      full_name: '',
      email: '',
      phone: '',
      primary_location_code: '',
      is_active: true,
    });
    setIsDialogOpen(true);
  }

  function handleDeleteClick(staffMember: SalesStaff) {
    setDeletingStaff(staffMember);
    setIsDeleteDialogOpen(true);
  }

  // Filter staff based on search and location
  const filteredStaff = staff.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.staff_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesLocation = locationFilter === 'all' || s.primary_location_code === locationFilter;

    return matchesSearch && matchesLocation;
  });

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Staff</h1>
          <p className="text-muted-foreground">Manage sales staff and their locations</p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Staff
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                <Input
                  placeholder="Search by name, code, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.code}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Members ({filteredStaff.length})</CardTitle>
          <CardDescription>Sales staff assigned to POS terminals and locations</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredStaff.length === 0 ? (
            <div className="py-12 text-center">
              <UserPlus className="text-muted-foreground mx-auto h-12 w-12" />
              <p className="mt-4 text-lg font-medium">No sales staff found</p>
              <p className="text-muted-foreground">
                {searchQuery || locationFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first staff member'}
              </p>
              {!searchQuery && locationFilter === 'all' && (
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Staff Member
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Code</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Primary Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.map((staffMember) => (
                  <TableRow key={staffMember.id}>
                    <TableCell className="font-medium">{staffMember.staff_code}</TableCell>
                    <TableCell>{staffMember.full_name}</TableCell>
                    <TableCell>{staffMember.email || '—'}</TableCell>
                    <TableCell>{staffMember.phone || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {locations.find((l) => l.code === staffMember.primary_location_code)
                          ?.name || staffMember.primary_location_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staffMember.is_active ? 'default' : 'secondary'}>
                        {staffMember.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(staffMember)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(staffMember)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
            <DialogDescription>
              {editingStaff ? 'Update staff member information' : 'Create a new sales staff member'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="staff_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Staff Code</FormLabel>
                      <FormControl>
                        <Input placeholder="QLD-JOHN" {...field} disabled={!!editingStaff} />
                      </FormControl>
                      <FormDescription>Format: STATE-NAME (e.g., QLD-JOHN)</FormDescription>
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
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
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
                      <FormLabel>Phone (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="+61 400 000 000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primary_location_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Location</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.code}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Default location for routing sales</FormDescription>
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setEditingStaff(null);
                    form.reset();
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingStaff ? 'Update Staff' : 'Create Staff'}
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
              This will permanently delete {deletingStaff?.full_name} ({deletingStaff?.staff_code}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingStaff(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
