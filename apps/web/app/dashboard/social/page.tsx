'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    BarChart3,
    Calendar,
    Check,
    Clock,
    Eye,
    Facebook,
    Instagram,
    Linkedin,
    MessageCircle,
    Plus,
    RefreshCw,
    Send,
    ThumbsDown,
    ThumbsUp,
    Trash2,
    X,
    Zap
} from 'lucide-react';
import { useState } from 'react';

// Types
interface SocialConnection {
  id: string;
  platform: 'Facebook' | 'Instagram' | 'LinkedIn' | 'Reddit';
  accountName: string;
  accountId: string;
  isActive: boolean;
  tokenExpiry?: string;
  status: 'active' | 'expired' | 'inactive';
}

interface SocialPost {
  id: string;
  content: string;
  hashtags: string[];
  status: 'Draft' | 'PendingApproval' | 'Approved' | 'Scheduled' | 'Published' | 'Failed';
  scheduledFor?: string;
  publishedAt?: string;
  connection: {
    platform: string;
    accountName: string;
  };
  likes?: number;
  comments?: number;
  shares?: number;
}

// Platform config
const platformConfig = {
  Facebook: {
    icon: Facebook,
    color: 'bg-blue-600',
    hoverColor: 'hover:bg-blue-700',
    textColor: 'text-blue-400',
    bgLight: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  Instagram: {
    icon: Instagram,
    color: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
    hoverColor: 'hover:opacity-90',
    textColor: 'text-pink-400',
    bgLight: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  LinkedIn: {
    icon: Linkedin,
    color: 'bg-sky-700',
    hoverColor: 'hover:bg-sky-800',
    textColor: 'text-sky-400',
    bgLight: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
  },
  Reddit: {
    icon: MessageCircle,
    color: 'bg-orange-600',
    hoverColor: 'hover:bg-orange-700',
    textColor: 'text-orange-400',
    bgLight: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
};

// Mock data for demonstration
const mockConnections: SocialConnection[] = [
  {
    id: '1',
    platform: 'Facebook',
    accountName: 'CCW Equipment',
    accountId: '123456789',
    isActive: true,
    status: 'active',
  },
  {
    id: '2',
    platform: 'LinkedIn',
    accountName: 'CCW Cleaning Equipment',
    accountId: 'ccw-equipment',
    isActive: true,
    status: 'active',
  },
];

const mockPosts: SocialPost[] = [
  {
    id: '1',
    content: '🔧 New Razorback Portable Extractor now available! Perfect for restoration professionals. #CarpetCleaning #Restoration',
    hashtags: ['CarpetCleaning', 'Restoration', 'CCWEquipment'],
    status: 'PendingApproval',
    connection: { platform: 'Facebook', accountName: 'CCW Equipment' },
  },
  {
    id: '2',
    content: 'Top 5 tips for water damage restoration. Learn from the experts at CCW! 💧',
    hashtags: ['WaterDamage', 'RestorationTips'],
    status: 'Scheduled',
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    connection: { platform: 'LinkedIn', accountName: 'CCW Cleaning Equipment' },
  },
  {
    id: '3',
    content: 'Check out our latest truckmount installation at a client site in Brisbane! 🚛',
    hashtags: ['Truckmount', 'Brisbane'],
    status: 'Published',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    connection: { platform: 'Instagram', accountName: 'ccw_equipment' },
    likes: 45,
    comments: 8,
    shares: 3,
  },
];

// Connection Card Component
function ConnectionCard({ connection, onDisconnect, onRefresh }: {
  connection: SocialConnection;
  onDisconnect: () => void;
  onRefresh: () => void;
}) {
  const config = platformConfig[connection.platform];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative p-4 rounded-xl border ${config.borderColor} ${config.bgLight}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-white truncate">{connection.accountName}</h4>
            {connection.status === 'active' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="w-3 h-3" /> Connected
              </span>
            )}
            {connection.status === 'expired' && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <AlertTriangle className="w-3 h-3" /> Token Expired
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400">{connection.platform}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Refresh token"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onDisconnect}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
            title="Disconnect"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Post Card Component
function PostCard({ post, onApprove, onReject }: {
  post: SocialPost;
  onApprove: () => void;
  onReject: () => void;
}) {
  const config = platformConfig[post.connection.platform as keyof typeof platformConfig] || platformConfig.Facebook;
  const Icon = config.icon;

  const statusColors = {
    Draft: 'bg-gray-500/20 text-gray-300',
    PendingApproval: 'bg-amber-500/20 text-amber-300',
    Approved: 'bg-emerald-500/20 text-emerald-300',
    Scheduled: 'bg-blue-500/20 text-blue-300',
    Published: 'bg-purple-500/20 text-purple-300',
    Failed: 'bg-red-500/20 text-red-300',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-colors"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-1.5 rounded-lg ${config.bgLight}`}>
          <Icon className={`w-4 h-4 ${config.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-400">{post.connection.accountName}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[post.status]}`}>
              {post.status}
            </span>
          </div>
        </div>
      </div>

      <p className="text-white text-sm mb-3 line-clamp-3">{post.content}</p>

      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {post.hashtags.map(tag => (
            <span key={tag} className="text-xs text-blue-400">#{tag}</span>
          ))}
        </div>
      )}

      {post.scheduledFor && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <Clock className="w-3 h-3" />
          Scheduled: {new Date(post.scheduledFor).toLocaleString()}
        </div>
      )}

      {post.status === 'Published' && (
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" /> {post.likes || 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" /> {post.comments || 0}
          </span>
          <span className="flex items-center gap-1">
            <Send className="w-3 h-3" /> {post.shares || 0}
          </span>
        </div>
      )}

      {post.status === 'PendingApproval' && (
        <div className="flex items-center gap-2 pt-3 border-t border-white/10">
          <button
            onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors"
          >
            <ThumbsUp className="w-4 h-4" /> Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          >
            <ThumbsDown className="w-4 h-4" /> Reject
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Compose Modal Component
function ComposeModal({ isOpen, onClose, connections }: {
  isOpen: boolean;
  onClose: () => void;
  connections: SocialConnection[];
}) {
  const [content, setContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 mx-4"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Create Post</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Select Platforms</label>
            <div className="flex flex-wrap gap-2">
              {connections.map(conn => {
                const config = platformConfig[conn.platform];
                const Icon = config.icon;
                const isSelected = selectedPlatforms.includes(conn.platform);

                return (
                  <button
                    key={conn.id}
                    onClick={() => togglePlatform(conn.platform)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      isSelected
                        ? `${config.borderColor} ${config.bgLight} ${config.textColor}`
                        : 'border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{conn.accountName}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Content</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What would you like to share?"
              className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50 resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${content.length > 280 ? 'text-amber-400' : 'text-gray-500'}`}>
                {content.length}/280
              </span>
            </div>
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Hashtags (comma separated)</label>
            <input
              type="text"
              value={hashtags}
              onChange={e => setHashtags(e.target.value)}
              placeholder="CarpetCleaning, Restoration, CCW"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!content || selectedPlatforms.length === 0 || isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#003366] to-[#004488] hover:from-[#004488] hover:to-[#003366] text-white rounded-xl font-medium disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSubmitting ? 'Posting...' : 'Post Now'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Main Social Dashboard Page
export default function SocialDashboard() {
  const [connections, setConnections] = useState<SocialConnection[]>(mockConnections);
  const [posts, setPosts] = useState<SocialPost[]>(mockPosts);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'connections' | 'analytics'>('posts');

  const handleConnect = async (platform: string) => {
    // In production, this would call the OAuth API
    window.location.href = `/api/auth/social/${platform.toLowerCase()}`;
  };

  const handleApprove = (postId: string) => {
    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, status: 'Approved' as const } : p))
    );
  };

  const handleReject = (postId: string) => {
    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, status: 'Draft' as const } : p))
    );
  };

  const pendingApproval = posts.filter(p => p.status === 'PendingApproval').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Social Media Hub</h1>
            <p className="text-gray-400">Manage and automate your social media presence</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003366] to-[#004488] hover:from-[#004488] hover:to-[#003366] text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Post
          </motion.button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-blue-500">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-400">Connected</span>
            </div>
            <p className="text-3xl font-bold text-white">{connections.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-amber-500">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-400">Pending Approval</span>
            </div>
            <p className="text-3xl font-bold text-white">{pendingApproval}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-purple-500">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-400">Scheduled</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {posts.filter(p => p.status === 'Scheduled').length}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-400">Published</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {posts.filter(p => p.status === 'Published').length}
            </p>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-4">
          {[
            { id: 'posts', label: 'Posts', icon: Send },
            { id: 'connections', label: 'Connections', icon: Zap },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'posts' && (
            <motion.div
              key="posts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onApprove={() => handleApprove(post.id)}
                  onReject={() => handleReject(post.id)}
                />
              ))}
            </motion.div>
          )}

          {activeTab === 'connections' && (
            <motion.div
              key="connections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {connections.map(conn => (
                  <ConnectionCard
                    key={conn.id}
                    connection={conn}
                    onDisconnect={() => setConnections(prev => prev.filter(c => c.id !== conn.id))}
                    onRefresh={() => console.log('Refresh', conn.id)}
                  />
                ))}
              </div>

              {/* Add New Connection */}
              <div className="bg-white/5 border border-dashed border-white/20 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-4">Connect a Platform</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['Facebook', 'Instagram', 'LinkedIn', 'Reddit'] as const).map(platform => {
                    const config = platformConfig[platform];
                    const Icon = config.icon;
                    const isConnected = connections.some(c => c.platform === platform);

                    return (
                      <button
                        key={platform}
                        onClick={() => !isConnected && handleConnect(platform)}
                        disabled={isConnected}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                          isConnected
                            ? 'border-emerald-500/30 bg-emerald-500/10 cursor-default'
                            : `border-white/10 hover:${config.borderColor} hover:${config.bgLight}`
                        }`}
                      >
                        <div className={`p-3 rounded-xl ${isConnected ? 'bg-emerald-500/20' : config.color}`}>
                          {isConnected ? (
                            <Check className="w-6 h-6 text-emerald-400" />
                          ) : (
                            <Icon className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <span className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-white'}`}>
                          {isConnected ? 'Connected' : platform}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Facebook Groups Notice */}
              <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-300">Facebook Groups API Deprecated</h4>
                    <p className="text-sm text-gray-400 mt-1">
                      As of April 2024, Facebook has removed the Groups API. Posting to industry groups 
                      must be done manually. The Content Planner will prepare copy-ready content for 
                      easy manual posting.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center"
            >
              <BarChart3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Analytics Coming Soon</h3>
              <p className="text-gray-400 max-w-md mx-auto">
                Track engagement, reach, and performance across all connected platforms. 
                This feature is currently in development.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose Modal */}
        <ComposeModal
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          connections={connections}
        />
      </div>
    </div>
  );
}
