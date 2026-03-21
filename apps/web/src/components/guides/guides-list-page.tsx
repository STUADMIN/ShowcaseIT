'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useApi, apiPost } from '@/hooks/use-api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Guide {
  id: string;
  title: string;
  description: string | null;
  style: string;
  published: boolean;
  updatedAt: string;
  _count: { steps: number };
}

export function GuidesListPage() {
  const { data: guides, loading, refetch } = useApi<Guide[]>({ url: '/api/guides' });
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreateBlankGuide() {
    setCreating(true);
    try {
      const guide = await apiPost('/api/guides', {
        title: 'Untitled Guide',
        description: '',
        style: 'business',
      });
      if (guide?.id) {
        router.push(`/guides/${guide.id}`);
      } else {
        refetch();
      }
    } catch {
      refetch();
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell>
        <div className="p-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold">Guides</h2>
              <p className="text-gray-400 mt-1">Create and manage your step-by-step guides</p>
            </div>
            {guides && guides.length > 0 && (
              <button onClick={handleCreateBlankGuide} disabled={creating} className="btn-primary">
                {creating ? 'Creating...' : '+ New Guide'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="card p-16 text-center"><p className="text-gray-500">Loading guides...</p></div>
          ) : !guides?.length ? (
            <div className="card p-16 text-center">
              <div className="text-6xl mb-4">📖</div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No guides yet</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Record your screen first and generate a guide, or create a blank guide and add steps manually.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/recordings/new" className="btn-primary inline-block">Record Screen</Link>
                <button onClick={handleCreateBlankGuide} disabled={creating} className="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white transition-colors">
                  {creating ? 'Creating...' : 'Create Blank Guide'}
                </button>
              </div>
            </div>
          ) : (
            <div className="si-stagger-in grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <Link key={guide.id} href={`/guides/${guide.id}`} className="card-hover cursor-pointer block">
                  <div className="aspect-video bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
                    <span className="text-gray-600 text-4xl">📖</span>
                  </div>
                  <h3 className="font-semibold text-gray-200">{guide.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{guide.description || 'No description'}</p>
                  <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
                    <span>{guide._count.steps} steps</span>
                    <span>{new Date(guide.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
    </AppShell>
  );
}
