'use client';

import { useState, useEffect } from 'react';
import { teamApi, type TeamMember, type TeamMemberRole } from '@/lib/api/team';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Edit, Trash2, Users, Shield, Mail } from 'lucide-react';
import { InviteTeamMemberForm } from './components/InviteTeamMemberForm';
import { EditRoleDialog } from './components/EditRoleDialog';
import { Separator } from '@/components/ui/separator';

// Role colors for badges
const ROLE_COLORS: Record<TeamMemberRole, string> = {
  owner: 'bg-purple-500',
  admin: 'bg-blue-500',
  member: 'bg-green-500',
  billing: 'bg-orange-500',
};

// Role descriptions
const ROLE_DESCRIPTIONS: Record<TeamMemberRole, string> = {
  owner: 'Full access - Billing, team management, all operations',
  admin: 'Full operational access - No billing or ownership changes',
  member: 'Read/write access to products, orders, customers',
  billing: 'Billing management only - View invoices, change plans',
};

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<TeamMemberRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    temporary_password: string;
    role: TeamMemberRole;
    must_change_password: boolean;
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm, roleFilter]);

  async function fetchTeamMembers() {
    try {
      setLoading(true);
      const response = await teamApi.list({
        page,
        page_size: 50,
        search: searchTerm || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
      });
      setMembers(response.data);
      setTotalPages(response.total_pages);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load team members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(userId: string, email: string) {
    try {
      await teamApi.remove(userId);
      toast({
        title: 'Success',
        description: `Removed "${email}" from team`,
      });
      fetchTeamMembers();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove team member',
        variant: 'destructive',
      });
    }
  }

  function handleInviteSuccess(credentials?: {
    email: string;
    temporary_password: string;
    role: TeamMemberRole;
    must_change_password: boolean;
  }) {
    setInviteDialogOpen(false);
    setCreatedCredentials(credentials ?? null);
    fetchTeamMembers();
  }

  function handleRoleUpdateSuccess() {
    fetchTeamMembers();
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Users className="h-8 w-8" />
            Team Management
          </h1>
          <p className="text-muted-foreground">Manage team members, roles, and permissions</p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Create a team user and assign access. You'll get one-time login credentials after
                saving.
              </DialogDescription>
            </DialogHeader>
            <InviteTeamMemberForm
              onSuccess={handleInviteSuccess}
              onCancel={() => setInviteDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={roleFilter}
          onValueChange={(value: string) => {
            setRoleFilter(value as TeamMemberRole | 'all');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Role Reference */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
          <div key={role} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <Badge className={ROLE_COLORS[role as TeamMemberRole]}>{role.toUpperCase()}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Loading team members...
                </TableCell>
              </TableRow>
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  No team members found
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <Mail className="text-muted-foreground h-4 w-4" />
                    {member.email}
                  </TableCell>
                  <TableCell>{member.full_name || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_COLORS[member.role]}>{member.role.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.is_active ? 'default' : 'secondary'}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <EditRoleDialog member={member} onSuccess={handleRoleUpdateSuccess} />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove "{member.email}" from the team? They
                              will lose access to the organization.
                              {member.role === 'owner' && (
                                <p className="mt-2 font-medium text-red-500">
                                  Warning: Cannot remove the last owner. Promote another member to
                                  owner first.
                                </p>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.id, member.email)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!createdCredentials} onOpenChange={(open) => !open && setCreatedCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login Credentials Generated</DialogTitle>
            <DialogDescription>
              Share these one-time credentials securely with the new team member.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-mono text-sm">{createdCredentials.email}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Temporary Password</p>
                <p className="font-mono text-sm">{createdCredentials.temporary_password}</p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Granted Role</p>
                <Badge className={ROLE_COLORS[createdCredentials.role]}>
                  {createdCredentials.role.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setCreatedCredentials(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
