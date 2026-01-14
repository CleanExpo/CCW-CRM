import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <header className="bg-ccw-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">
            CCW Digital Operations Hub
          </h1>
          <p className="text-xl text-blue-200 mb-8">
            AI-Powered Operations for Australia&apos;s #1 Cleaning Equipment Supplier
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-ccw-gold text-ccw-navy font-bold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Launch Dashboard
            </Link>
            <a
              href="https://ccwonline.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-white/30 text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              Visit CCW Website →
            </a>
          </div>
        </div>
      </header>

      {/* Features */}
      <main className="flex-1 bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Agentic Operations Platform
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-ccw-navy">
              <h3 className="font-bold text-lg mb-2">Service Kanban</h3>
              <p className="text-gray-600 text-sm">
                Track equipment repairs across Boondall, Seven Hills, and Bayswater with drag-and-drop workflow management.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-ccw-gold">
              <h3 className="font-bold text-lg mb-2">Marketing Agents</h3>
              <p className="text-gray-600 text-sm">
                AI-powered campaign creation with competitor analysis and CCW brand voice. Human approval required.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-ccw-navy">
              <h3 className="font-bold text-lg mb-2">Inventory Intelligence</h3>
              <p className="text-gray-600 text-sm">
                Real-time stock levels across all Australian warehouses. Automated reorder alerts.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-ccw-navy text-white py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-blue-200">
            CCW Digital Operations Hub — 100% Australian Owned
          </p>
          <p className="text-xs text-blue-300/60 mt-2">
            Boondall (QLD) • Seven Hills (NSW) • Bayswater (VIC)
          </p>
        </div>
      </footer>
    </div>
  );
}
