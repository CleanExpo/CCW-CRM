import '../globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'CCW Mobile Order',
  description: 'Create orders on-site by photographing cleaning equipment',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 text-white">{children}</div>;
}
