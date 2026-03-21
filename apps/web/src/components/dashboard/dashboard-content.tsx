'use client';

import { useApi } from '@/hooks/use-api';
import Link from 'next/link';

interface DashboardStats {
  guides: number;
  recordings: number;
  projects: number;
  recentGuides: Array<{ id: string; title: string; updatedAt: string; _count: { steps: number } }>;
  recentRecordings: Array<{ id: string; title: string; createdAt: string }>;
}

export function DashboardContent() {
  const { data: stats, loading } = useApi<DashboardStats>({ url: '/api/dashboard/stats' });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold">Welcome to ShowcaseIt</h2>
        <p className="text-gray-400 mt-2">
          Create beautiful, branded user manuals from screen recordings
        </p>
      </header>

      <div className="si-stagger-in grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
        <StatCard title="Recordings" value={loading ? '...' : String(stats?.recordings ?? 0)} subtitle="Total captures" />
        <StatCard title="Guides" value={loading ? '...' : String(stats?.guides ?? 0)} subtitle="Published guides" />
        <StatCard title="Projects" value={loading ? '...' : String(stats?.projects ?? 0)} subtitle="Active projects" />
      </div>

      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="si-stagger-in grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/recordings/new"><ActionCard icon="🎬" title="New Recording" description="Start a screen capture session" /></Link>
          <Link href="/guides"><ActionCard icon="📝" title="Create Guide" description="Build a step-by-step manual" /></Link>
          <Link href="/brand"><ActionCard icon="🎨" title="Brand Kit" description="Configure your brand styling" /></Link>
          <Link href="/export"><ActionCard icon="📤" title="Export & Publish" description="Share to web or social media" /></Link>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-4">Recent Guides</h3>
        {!stats?.recentGuides?.length ? (
          <div className="card p-12 text-center">
            <p className="text-gray-500 text-lg">No guides yet</p>
            <p className="text-gray-600 text-sm mt-2">Record your screen first, then generate a guide from the recording</p>
            <div className="flex gap-4 justify-center mt-6">
              <Link href="/recordings/new" className="btn-primary inline-block">Record Screen</Link>
              <Link href="/guides" className="inline-block px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors">Create Blank Guide</Link>
            </div>
          </div>
        ) : (
          <div className="si-stagger-in grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.recentGuides.map((guide) => (
              <Link key={guide.id} href={`/guides/${guide.id}`} className="card-hover">
                <h4 className="font-semibold text-gray-200">{guide.title}</h4>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                  <span>{guide._count.steps} steps</span>
                  <span>{new Date(guide.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="text-4xl font-bold mt-2 text-gradient">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </div>
  );
}

function ActionCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="card-hover text-left group">
      <span className="text-3xl block mb-3 group-hover:scale-110 transition-transform duration-200 inline-block">{icon}</span>
      <h4 className="font-semibold text-gray-200">{title}</h4>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}
