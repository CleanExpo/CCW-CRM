"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X } from "lucide-react";

interface TeamInviteStepProps {
  onComplete: (data?: any) => void;
  onSkip: () => void;
  onBack: () => void;
  canGoBack: boolean;
  isOptional: boolean;
}

interface TeamMemberInvite {
  email: string;
  role: string;
}

export function TeamInviteStep({ onComplete, onSkip, onBack, isOptional }: TeamInviteStepProps) {
  const [isInviting, setIsInviting] = useState(false);
  const [invites, setInvites] = useState<TeamMemberInvite[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentRole, setCurrentRole] = useState("member");

  const handleAdd = () => {
    if (currentEmail && currentRole) {
      setInvites([...invites, { email: currentEmail, role: currentRole }]);
      setCurrentEmail("");
      setCurrentRole("member");
    }
  };

  const handleRemove = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  async function handleSendInvites() {
    if (invites.length === 0) {
      onComplete({ invites: [] });
      return;
    }

    setIsInviting(true);
    try {
      // TODO: Send team invites via API
      // await teamApi.inviteBulk(invites);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onComplete({ invites });
    } finally {
      setIsInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Invite your team members to collaborate. They'll receive an email with setup instructions.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="teammate@company.com"
              value={currentEmail}
              onChange={(e) => setCurrentEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              disabled={isInviting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <div className="flex gap-2">
              <Select value={currentRole} onValueChange={setCurrentRole} disabled={isInviting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAdd}
                disabled={!currentEmail || isInviting}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {invites.length > 0 && (
          <div className="rounded-lg border divide-y">
            {invites.map((invite, index) => (
              <div key={index} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{invite.email}</span>
                  <Badge variant="secondary">{invite.role}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={isInviting}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {invites.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No team members added yet. Add email addresses above.
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isInviting}>
          Back
        </Button>
        <div className="flex gap-2">
          {isOptional && (
            <Button variant="ghost" onClick={onSkip} disabled={isInviting}>
              Skip for Now
            </Button>
          )}
          <Button onClick={handleSendInvites} disabled={isInviting}>
            {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {invites.length > 0 ? `Send ${invites.length} Invite${invites.length > 1 ? "s" : ""}` : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
