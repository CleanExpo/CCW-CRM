import { apiClient } from "./client";

/**
 * Team member role (RBAC)
 */
export type TeamMemberRole = "owner" | "admin" | "member" | "billing";

/**
 * Team member interface
 */
export interface TeamMember {
  id: string;
  email: string;
  full_name?: string;
  role: TeamMemberRole;
  is_active: boolean;
  created_at: string;
}

/**
 * Invite new team member request
 */
export interface TeamMemberInvite {
  email: string;
  full_name?: string;
  role?: TeamMemberRole;
}

export interface TeamInviteCredentials {
  email: string;
  temporary_password: string;
  role: TeamMemberRole;
  must_change_password: boolean;
}

export interface TeamInviteResponse {
  member: TeamMember;
  credentials: TeamInviteCredentials;
}

/**
 * Update team member role request
 */
export interface TeamMemberRoleUpdate {
  role: TeamMemberRole;
}

/**
 * Team member list params
 */
export interface TeamMemberListParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: TeamMemberRole;
}

/**
 * Paginated team member response
 */
export interface PaginatedTeamMembers {
  data: TeamMember[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Team Management API client
 */
export const teamApi = {
  /**
   * List team members with pagination and filters
   */
  async list(params: TeamMemberListParams = {}): Promise<PaginatedTeamMembers> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params.search) queryParams.append("search", params.search);
    if (params.role) queryParams.append("role", params.role);

    return apiClient.get<PaginatedTeamMembers>(`/api/team?${queryParams.toString()}`);
  },

  /**
   * Invite a new team member
   */
  async invite(data: TeamMemberInvite): Promise<TeamInviteResponse> {
    return apiClient.post<TeamInviteResponse>("/api/team/invite", data);
  },

  /**
   * Update team member role
   */
  async updateRole(userId: string, data: TeamMemberRoleUpdate): Promise<TeamMember> {
    return apiClient.put<TeamMember>(`/api/team/${userId}/role`, data);
  },

  /**
   * Remove team member (soft delete)
   */
  async remove(userId: string): Promise<void> {
    return apiClient.delete(`/api/team/${userId}`);
  },
};
