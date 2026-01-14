import { KanbanBoard } from '@/src/components/dashboard/KanbanBoard';
import { ApprovalDashboard } from '@/src/components/dashboard/ApprovalDashboard';

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-ccw-navy shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-white">
                            CCW Digital Operations Hub
                        </h1>
                        <span className="px-2 py-0.5 bg-ccw-gold text-ccw-navy text-xs font-bold rounded">
                            BETA
                        </span>
                    </div>
                    <nav className="flex gap-4">
                        <a href="/dashboard" className="text-white font-medium">Dashboard</a>
                        <a href="/dashboard/agents" className="text-white/70 hover:text-white">Agents</a>
                        <a href="/dashboard/inventory" className="text-white/70 hover:text-white">Inventory</a>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Approval Dashboard */}
                <section>
                    <ApprovalDashboard />
                </section>

                {/* Service Kanban */}
                <section className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <KanbanBoard />
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-ccw-navy text-white/60 text-center py-4 text-sm mt-8">
                CCW Digital Operations Hub © 2026 — 100% Australian Owned
            </footer>
        </div>
    );
}
