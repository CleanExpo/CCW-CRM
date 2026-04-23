"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamApi, type TeamMember, type TeamMemberRole } from "@/lib/api/team";
import { useToast } from "@/hooks/use-toast";
import { Edit, Loader2 } from "lucide-react";

interface EditRoleDialogProps {
  member: TeamMember;
  onSuccess?: () => void;
}

const ROLE_LABELS: Record<TeamMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  billing: "CFO/Finance Staff",
};

export function EditRoleDialog({ member, onSuccess }: EditRoleDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TeamMemberRole>(member.role);
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpdateRole() {
    if (selectedRole === member.role) {
      setOpen(false);
      return;
    }

    setIsLoading(true);

    try {
      await teamApi.updateRole(member.id, { role: selectedRole });

      toast({
        title: "Role Updated",
        description: `Changed ${member.email}'s role to ${ROLE_LABELS[selectedRole]}`,
      });

      setOpen(false);
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update role";
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role</DialogTitle>
          <DialogDescription>
            Update the role for {member.email}. This will change their permissions immediately and
            require them to re-login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Role</label>
            <div className="text-sm text-muted-foreground">{ROLE_LABELS[member.role]}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Role</label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TeamMemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="billing">{ROLE_LABELS.billing}</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {member.role === "owner" && selectedRole !== "owner" && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              <p className="font-medium">Warning</p>
              <p>
                Changing the owner's role requires at least one other owner in the organization.
                This action will fail if this is the last owner.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleUpdateRole} disabled={isLoading || selectedRole === member.role}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Role
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
