'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AgentInfo {
    id: string;
    name: string;
    description: string;
    status: 'idle' | 'running' | 'error';
    tools: string[];
    lastRun?: string;
}

const AGENTS: AgentInfo[] = [
    {
        id: 'marketing_specialist',
        name: 'Marketing Specialist',
        description: 'Creates multi-channel campaigns based on inventory and competitor pricing.',
        status: 'idle',
        tools: ['check_warehouse_stock', 'analyze_ccw_website', 'generate_campaign_draft'],
    },
    {
        id: 'service_orchestrator',
        name: 'Service Orchestrator',
        description: 'Manages equipment repairs across QLD, NSW, and VIC service hubs.',
        status: 'idle',
        tools: ['update_kanban_stage', 'generate_service_report', 'notify_customer'],
    },
    {
        id: 'marketing_handoff',
        name: 'Marketing Handoff',
        description: 'Routes tasks to Copywriter and Visual Brand specialist agents.',
        status: 'idle',
        tools: ['transfer_to_creative_team', 'transfer_to_visual_team'],
    },
];

export default function AgentsPage() {
    const [agents, setAgents] = useState(AGENTS);
    const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
    const [input, setInput] = useState('');

    const handleRunAgent = async (agentId: string) => {
        if (!input.trim()) return;

        setAgents((prev) =>
            prev.map((a) => (a.id === agentId ? { ...a, status: 'running' as const } : a))
        );

        try {
            const response = await fetch('/api/agents/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId, input }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to run agent');
            }

            // Poll for completion
            const pollInterval = setInterval(async () => {
                const statusRes = await fetch(`/api/agents/run?runId=${data.runId}`);
                const statusData = await statusRes.json();

                if (statusData.status === 'completed' || statusData.status === 'error' || statusData.status === 'pending_approval') {
                    clearInterval(pollInterval);
                    setAgents((prev) =>
                        prev.map((a) =>
                            a.id === agentId
                                ? { ...a, status: 'idle' as const, lastRun: new Date().toISOString() }
                                : a
                        )
                    );
                    setInput('');
                    setSelectedAgent(null);
                }
            }, 1000);

            // Timeout after 60 seconds
            setTimeout(() => clearInterval(pollInterval), 60000);

        } catch (error) {
            console.error('Agent run failed:', error);
            setAgents((prev) =>
                prev.map((a) =>
                    a.id === agentId ? { ...a, status: 'error' as const } : a
                )
            );
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-ccw-navy shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white">CCW Digital Operations Hub</h1>
                        <span className="px-2 py-0.5 bg-ccw-gold text-ccw-navy text-xs font-bold rounded">BETA</span>
                    </div>
                    <nav className="flex gap-4">
                        <Link href="/dashboard" className="text-white/70 hover:text-white">Dashboard</Link>
                        <Link href="/dashboard/agents" className="text-white font-medium">Agents</Link>
                        <Link href="/dashboard/inventory" className="text-white/70 hover:text-white">Inventory</Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Agent Management</h2>

                <div className="grid gap-6">
                    {agents.map((agent) => (
                        <div key={agent.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-lg text-ccw-navy">{agent.name}</h3>
                                    <p className="text-sm text-gray-600">{agent.description}</p>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-medium ${agent.status === 'running'
                                        ? 'bg-green-100 text-green-700'
                                        : agent.status === 'error'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    {agent.status === 'running' ? '● Running' : agent.status === 'error' ? '● Error' : '○ Idle'}
                                </span>
                            </div>

                            <div className="px-6 py-4">
                                <div className="mb-4">
                                    <span className="text-xs text-gray-500 block mb-2">Tools:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {agent.tools.map((tool) => (
                                            <code key={tool} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                {tool}
                                            </code>
                                        ))}
                                    </div>
                                </div>

                                {selectedAgent === agent.id ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Enter task for agent..."
                                            className="w-full p-3 border border-gray-300 rounded-lg text-sm"
                                            rows={3}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleRunAgent(agent.id)}
                                                disabled={agent.status === 'running'}
                                                className="px-4 py-2 bg-ccw-navy text-white rounded font-medium text-sm disabled:opacity-50"
                                            >
                                                {agent.status === 'running' ? 'Running...' : 'Run Agent'}
                                            </button>
                                            <button
                                                onClick={() => setSelectedAgent(null)}
                                                className="px-4 py-2 border border-gray-300 rounded text-sm"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setSelectedAgent(agent.id)}
                                        className="px-4 py-2 bg-ccw-gold text-ccw-navy rounded font-medium text-sm"
                                    >
                                        Start Task
                                    </button>
                                )}

                                {agent.lastRun && (
                                    <p className="text-xs text-gray-400 mt-3">
                                        Last run: {new Date(agent.lastRun).toLocaleString('en-AU')}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
