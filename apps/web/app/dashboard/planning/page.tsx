'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Image,
    Video,
    FileText,
    Clock,
    CheckCircle2,
    AlertCircle,
    Play,
    Pause,
    RotateCcw,
    Sparkles,
    Layers,
    TrendingUp,
    Send,
    Eye,
    ThumbsUp,
    ThumbsDown,
} from 'lucide-react';

// Types
interface ContentCalendarEntry {
    id: string;
    title: string;
    description: string;
    cadence: 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';
    scheduledDate: string;
    contentType: 'SocialMedia' | 'WebSpecial' | 'Newsletter' | 'CatalogueUpdate' | 'PerformanceReport';
    status: 'Draft' | 'Scheduled' | 'PendingApproval' | 'Approved' | 'Published';
    assets: string[];
}

interface AssetJob {
    id: string;
    type: 'Image' | 'Video' | 'SVG_Infographic';
    status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
    title: string;
    createdAt: string;
    completedAt?: string;
    thumbnail?: string;
}

interface ApprovalItem {
    id: string;
    type: 'Content' | 'Asset' | 'Batch';
    title: string;
    description: string;
    createdAt: string;
    previewUrl?: string;
}

// Mock data for demonstration
const mockCalendarEntries: ContentCalendarEntry[] = [
    {
        id: '1',
        title: 'Razorback Portable Special',
        description: 'Weekly special promotion for Razorback Portable Extractors',
        cadence: 'Weekly',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'WebSpecial',
        status: 'PendingApproval',
        assets: ['img-001'],
    },
    {
        id: '2',
        title: 'Restoration Tips Social Post',
        description: 'Share top 5 water damage restoration tips',
        cadence: 'Weekly',
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'SocialMedia',
        status: 'Scheduled',
        assets: [],
    },
    {
        id: '3',
        title: 'January Industry Newsletter',
        description: 'Monthly newsletter with product updates and industry news',
        cadence: 'Monthly',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        contentType: 'Newsletter',
        status: 'Draft',
        assets: ['svg-001'],
    },
];

const mockAssetJobs: AssetJob[] = [
    {
        id: 'job-001',
        type: 'Image',
        status: 'Completed',
        title: 'Razorback Portable - Warehouse Shot',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'job-002',
        type: 'Video',
        status: 'Processing',
        title: 'CCW Logo Reveal Animation',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
        id: 'job-003',
        type: 'SVG_Infographic',
        status: 'Queued',
        title: 'Top 5 Restoration Tips Infographic',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
];

const mockApprovalItems: ApprovalItem[] = [
    {
        id: 'approval-001',
        type: 'Batch',
        title: 'Week 3 Content Batch',
        description: '3 social posts, 1 web special, 2 product images',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'approval-002',
        type: 'Asset',
        title: 'Truckmount Hero Image',
        description: 'Product render for homepage banner',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
];

// Stat Card Component
function StatCard({
    icon: Icon,
    label,
    value,
    trend,
    color
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    trend?: string;
    color: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6"
        >
            <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl ${color}`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-emerald-400 text-sm">
                        <TrendingUp className="w-4 h-4" />
                        {trend}
                    </div>
                )}
            </div>
            <div className="mt-4">
                <p className="text-3xl font-bold text-white">{value}</p>
                <p className="text-sm text-gray-400 mt-1">{label}</p>
            </div>
        </motion.div>
    );
}

// Calendar Entry Card
function CalendarEntryCard({ entry }: { entry: ContentCalendarEntry }) {
    const statusColors = {
        Draft: 'bg-gray-500/20 text-gray-300',
        Scheduled: 'bg-blue-500/20 text-blue-300',
        PendingApproval: 'bg-amber-500/20 text-amber-300',
        Approved: 'bg-emerald-500/20 text-emerald-300',
        Published: 'bg-purple-500/20 text-purple-300',
    };

    const typeIcons = {
        SocialMedia: Send,
        WebSpecial: Sparkles,
        Newsletter: FileText,
        CatalogueUpdate: Layers,
        PerformanceReport: TrendingUp,
    };

    const TypeIcon = typeIcons[entry.contentType];

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
        >
            <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-[#003366]">
                    <TypeIcon className="w-5 h-5 text-[#FFCC00]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white truncate">{entry.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[entry.status]}`}>
                            {entry.status}
                        </span>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-1">{entry.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(entry.scheduledDate).toLocaleDateString()}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5">{entry.cadence}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// Asset Job Card
function AssetJobCard({ job }: { job: AssetJob }) {
    const statusConfig: Record<AssetJob['status'], { icon: React.ElementType; color: string; bg: string; animate?: boolean }> = {
        Queued: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
        Processing: { icon: RotateCcw, color: 'text-blue-400', bg: 'bg-blue-500/20', animate: true },
        Completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
        Failed: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
    };

    const typeIcons = {
        Image: Image,
        Video: Video,
        SVG_Infographic: FileText,
    };

    const config = statusConfig[job.status];
    const StatusIcon = config.icon;
    const TypeIcon = typeIcons[job.type];

    return (
        <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg">
            <div className={`p-2 rounded-lg ${config.bg}`}>
                <TypeIcon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{job.title}</p>
                <p className="text-xs text-gray-500">{job.type}</p>
            </div>
            <StatusIcon
                className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`}
            />
        </div>
    );
}

// Approval Card
function ApprovalCard({
    item,
    onApprove,
    onReject
}: {
    item: ApprovalItem;
    onApprove: () => void;
    onReject: () => void;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4"
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <span className="text-xs text-amber-400 uppercase tracking-wider">{item.type} Review</span>
                    <h4 className="font-medium text-white mt-1">{item.title}</h4>
                </div>
                <Eye className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm text-gray-400 mb-4">{item.description}</p>
            <div className="flex items-center gap-2">
                <button
                    onClick={onApprove}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors"
                >
                    <ThumbsUp className="w-4 h-4" />
                    Approve
                </button>
                <button
                    onClick={onReject}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                >
                    <ThumbsDown className="w-4 h-4" />
                    Reject
                </button>
            </div>
        </motion.div>
    );
}

// Main Planning Dashboard Page
export default function PlanningDashboard() {
    const [calendarEntries, setCalendarEntries] = useState<ContentCalendarEntry[]>(mockCalendarEntries);
    const [assetJobs, setAssetJobs] = useState<AssetJob[]>(mockAssetJobs);
    const [approvalItems, setApprovalItems] = useState<ApprovalItem[]>(mockApprovalItems);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleApprove = (id: string) => {
        setApprovalItems(items => items.filter(item => item.id !== id));
        // In production, this would call the API
    };

    const handleReject = (id: string) => {
        setApprovalItems(items => items.filter(item => item.id !== id));
        // In production, this would call the API with rejection reason
    };

    const handleGenerateContent = async () => {
        setIsGenerating(true);
        // Simulate API call
        setTimeout(() => {
            setIsGenerating(false);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Creative Planning Suite
                        </h1>
                        <p className="text-gray-400">
                            Autonomous content generation & scheduling for CCW
                        </p>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleGenerateContent}
                        disabled={isGenerating}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003366] to-[#004488] hover:from-[#004488] hover:to-[#003366] text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all"
                    >
                        {isGenerating ? (
                            <RotateCcw className="w-5 h-5 animate-spin" />
                        ) : (
                            <Sparkles className="w-5 h-5" />
                        )}
                        {isGenerating ? 'Generating...' : 'Generate Week Plan'}
                    </motion.button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={Calendar}
                        label="Scheduled Content"
                        value={calendarEntries.filter(e => e.status === 'Scheduled').length}
                        trend="+12%"
                        color="bg-blue-500"
                    />
                    <StatCard
                        icon={Image}
                        label="Assets Generated"
                        value={assetJobs.filter(j => j.status === 'Completed').length}
                        color="bg-purple-500"
                    />
                    <StatCard
                        icon={AlertCircle}
                        label="Pending Approval"
                        value={approvalItems.length}
                        color="bg-amber-500"
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Published This Week"
                        value={8}
                        trend="+24%"
                        color="bg-emerald-500"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Content Calendar */}
                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-[#FFCC00]" />
                                Content Calendar
                            </h2>
                            <select className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50">
                                <option value="all">All Cadences</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                            </select>
                        </div>
                        <div className="space-y-3">
                            <AnimatePresence>
                                {calendarEntries.map(entry => (
                                    <CalendarEntryCard key={entry.id} entry={entry} />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    <div className="space-y-6">
                        {/* Asset Generation Queue */}
                        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                                <Layers className="w-5 h-5 text-[#FFCC00]" />
                                Asset Queue
                            </h3>
                            <div className="space-y-3">
                                {assetJobs.map(job => (
                                    <AssetJobCard key={job.id} job={job} />
                                ))}
                            </div>
                        </div>

                        {/* Pending Approvals */}
                        {approvalItems.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-amber-400" />
                                    Pending Your Approval
                                </h3>
                                {approvalItems.map(item => (
                                    <ApprovalCard
                                        key={item.id}
                                        item={item}
                                        onApprove={() => handleApprove(item.id)}
                                        onReject={() => handleReject(item.id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Autonomous Workflow Status */}
                <div className="mt-8 bg-gradient-to-r from-[#003366]/20 to-[#004488]/20 border border-[#003366]/30 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Autonomous Workflow Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {[
                            { step: 1, label: 'Content Planner identifies special', status: 'completed' },
                            { step: 2, label: 'Imagen 3 generates product render', status: 'completed' },
                            { step: 3, label: 'Veo creates logo animation', status: 'processing' },
                            { step: 4, label: 'System compiles infographic', status: 'pending' },
                            { step: 5, label: 'HITL: Approve batch', status: 'pending' },
                        ].map(({ step, label, status }) => (
                            <div
                                key={step}
                                className={`relative p-4 rounded-xl border ${status === 'completed'
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : status === 'processing'
                                        ? 'bg-blue-500/10 border-blue-500/30'
                                        : 'bg-white/5 border-white/10'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${status === 'completed'
                                        ? 'bg-emerald-500 text-white'
                                        : status === 'processing'
                                            ? 'bg-blue-500 text-white animate-pulse'
                                            : 'bg-white/20 text-gray-400'
                                        }`}>
                                        {step}
                                    </span>
                                    {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                    {status === 'processing' && <RotateCcw className="w-4 h-4 text-blue-400 animate-spin" />}
                                </div>
                                <p className={`text-sm ${status === 'pending' ? 'text-gray-500' : 'text-gray-300'}`}>
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
