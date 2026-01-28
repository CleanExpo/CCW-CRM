"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, StopCircle, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExecutionLoopStatus {
  is_running: boolean;
  active_projects: string[];
  paused_projects: string[];
  total_projects_completed: number;
  total_tasks_completed: number;
  total_tasks_failed: number;
  uptime_seconds: number;
}

interface ProjectProgress {
  project_id: string;
  name: string;
  current_phase: string | null;
  progress_percentage: number;
  statistics: {
    total_phases: number;
    completed_phases: number;
    failed_phases: number;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    success_rate: number;
    duration_seconds: number;
  };
}

interface AgentActivity {
  agent_id: string;
  name: string;
  capabilities: string[];
  active_executions: number;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  health_status: string;
}

export default function AutonomousDevPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ExecutionLoopStatus | null>(null);
  const [projects, setProjects] = useState<ProjectProgress[]>([]);
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch status
  const fetchStatus = async () => {
    try {
      const response = await apiClient.get<ExecutionLoopStatus>("/api/autonomous/status");
      setStatus(response);
    } catch (error: any) {
      console.error("Failed to fetch status:", error);
    }
  };

  // Fetch projects
  const fetchProjects = async () => {
    try {
      const response = await apiClient.get<{ projects: ProjectProgress[] }>("/api/autonomous/projects");
      setProjects(response.projects || []);
    } catch (error: any) {
      console.error("Failed to fetch projects:", error);
    }
  };

  // Fetch agent activity
  const fetchAgents = async () => {
    try {
      const response = await apiClient.get<{ agents: AgentActivity[] }>("/api/autonomous/agents/activity");
      setAgents(response.agents || []);
    } catch (error: any) {
      console.error("Failed to fetch agents:", error);
    }
  };

  // Fetch all data
  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchStatus(), fetchProjects(), fetchAgents()]);
    setIsLoading(false);
  };

  // Initial load
  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Start execution loop
  const handleStart = async () => {
    try {
      await apiClient.post("/api/autonomous/start", {});
      toast({
        title: "Started",
        description: "Autonomous execution loop started",
      });
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start execution loop",
        variant: "destructive",
      });
    }
  };

  // Stop execution loop
  const handleStop = async () => {
    try {
      await apiClient.post("/api/autonomous/stop", {});
      toast({
        title: "Stopped",
        description: "Autonomous execution loop stopped",
      });
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to stop execution loop",
        variant: "destructive",
      });
    }
  };

  // Resume project
  const handleResume = async (projectId: string) => {
    try {
      await apiClient.post("/api/autonomous/projects/resume", { project_id: projectId });
      toast({
        title: "Resumed",
        description: "Project resumed",
      });
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resume project",
        variant: "destructive",
      });
    }
  };

  // Format uptime
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading autonomous development dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Autonomous Development</h1>
          <p className="text-muted-foreground">Monitor and manage autonomous development projects</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto-refresh On" : "Auto-refresh Off"}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Execution Loop Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Execution Loop Status</span>
            <Badge variant={status?.is_running ? "default" : "secondary"}>
              {status?.is_running ? "Running" : "Stopped"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Autonomous execution loop continuously processes development projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Projects Completed</p>
              <p className="text-2xl font-bold">{status?.total_projects_completed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasks Completed</p>
              <p className="text-2xl font-bold text-green-600">{status?.total_tasks_completed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tasks Failed</p>
              <p className="text-2xl font-bold text-red-600">{status?.total_tasks_failed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <p className="text-2xl font-bold">{status ? formatUptime(status.uptime_seconds) : "0h 0m 0s"}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!status?.is_running ? (
              <Button onClick={handleStart}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Start Execution Loop
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleStop}>
                <StopCircle className="h-4 w-4 mr-2" />
                Stop Execution Loop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Projects */}
      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {status?.active_projects.length || 0} active, {status?.paused_projects.length || 0} paused
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.map((project) => {
                const isActive = status?.active_projects.includes(project.project_id);
                const isPaused = status?.paused_projects.includes(project.project_id);

                return (
                  <div key={project.project_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {project.current_phase ? `Phase: ${project.current_phase}` : "Not started"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <Badge variant="default">
                            <Clock className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {isPaused && (
                          <Badge variant="secondary">
                            Paused (Awaiting Approval)
                          </Badge>
                        )}
                        {project.statistics.success_rate === 100 && (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {isPaused && (
                          <Button size="sm" onClick={() => handleResume(project.project_id)}>
                            Resume
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-semibold">{project.progress_percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={project.progress_percentage} className="h-2" />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Phases</p>
                        <p className="font-semibold">
                          {project.statistics.completed_phases}/{project.statistics.total_phases}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tasks</p>
                        <p className="font-semibold">
                          {project.statistics.completed_tasks}/{project.statistics.total_tasks}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <p className="font-semibold">{project.statistics.success_rate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Activity */}
      {agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Activity</CardTitle>
            <CardDescription>Current status of all development agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.agent_id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {agent.capabilities.join(", ")}
                      </p>
                    </div>
                    <Badge variant={agent.health_status === "active" ? "default" : "secondary"}>
                      {agent.health_status || "unknown"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Active</p>
                      <p className="font-semibold">{agent.active_executions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-semibold">{agent.total_executions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Successful</p>
                      <p className="font-semibold text-green-600">{agent.successful_executions}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Failed</p>
                      <p className="font-semibold text-red-600">{agent.failed_executions}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No projects found</p>
            <p className="text-sm text-muted-foreground">
              Create a new autonomous development project to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
