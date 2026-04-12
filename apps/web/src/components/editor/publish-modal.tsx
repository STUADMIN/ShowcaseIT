'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiPost, apiDelete } from '@/hooks/use-api';

interface ProjectOption {
  id: string;
  name: string;
  brandKit?: { id: string; name: string } | null;
}

interface BrandKitOption {
  id: string;
  name: string;
}

interface Publication {
  id: string;
  guideId: string;
  projectId: string;
  brandKitId: string | null;
  project: { id: string; name: string; brandKit?: { id: string; name: string } | null };
  brandKit: { id: string; name: string } | null;
}

export interface PublishModalProps {
  open: boolean;
  guideId: string;
  currentProjectId: string;
  onClose: () => void;
  /** Available projects in the workspace (excluding current) */
  projects: ProjectOption[];
  brandKits: BrandKitOption[];
}

export function PublishModal({ open, guideId, currentProjectId, onClose, projects, brandKits }: PublishModalProps) {
  const [mounted, setMounted] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/guides/${guideId}/publish`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPublications(Array.isArray(data) ? data : []))
      .catch(() => setPublications([]))
      .finally(() => setLoading(false));
  }, [open, guideId]);

  const availableProjects = projects.filter((p) => p.id !== currentProjectId);

  const handlePublish = async () => {
    if (!selectedProject) return;
    setBusy(true);
    setError('');
    try {
      const pub = await apiPost<Publication>(`/api/guides/${guideId}/publish`, {
        projectId: selectedProject,
        brandKitId: selectedBrand || null,
      });
      setPublications((prev) => [pub, ...prev.filter((p) => p.id !== pub.id)]);
      setSelectedProject('');
      setSelectedBrand('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublish = async (pubId: string) => {
    setBusy(true);
    try {
      await apiDelete(`/api/guides/${guideId}/publish?publicationId=${pubId}`);
      setPublications((prev) => prev.filter((p) => p.id !== pubId));
    } catch {
      setError('Failed to unpublish');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Publish to...</h2>
        <p className="text-xs text-gray-400 mb-4">
          Publish this guide to other projects. The content stays in sync — only the brand styling changes.
        </p>

        {/* Existing publications */}
        {loading ? (
          <p className="text-xs text-gray-500 mb-4">Loading...</p>
        ) : publications.length > 0 ? (
          <div className="mb-4 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Currently published to</p>
            {publications.map((pub) => (
              <div key={pub.id} className="flex items-center justify-between rounded-lg bg-gray-800 px-3 py-2">
                <div className="text-sm text-gray-200">
                  <span className="font-medium">{pub.project.name}</span>
                  {pub.brandKit ? (
                    <span className="text-gray-400 ml-1">— {pub.brandKit.name}</span>
                  ) : pub.project.brandKit ? (
                    <span className="text-gray-500 ml-1">({pub.project.brandKit.name})</span>
                  ) : null}
                </div>
                <button
                  onClick={() => handleUnpublish(pub.id)}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Unpublish
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* New publication form */}
        <div className="space-y-3 border-t border-gray-700 pt-4">
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Target project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-600"
            >
              <option value="">Select a project...</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brandKit ? `${p.brandKit.name} — ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Brand override (optional)</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-600"
            >
              <option value="">Use target project's brand</option>
              {brandKits.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePublish}
              disabled={!selectedProject || busy}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {busy ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export interface BulkPublishModalProps {
  open: boolean;
  sourceProjectId: string;
  onClose: () => void;
  projects: ProjectOption[];
  brandKits: BrandKitOption[];
}

export function BulkPublishModal({ open, sourceProjectId, onClose, projects, brandKits }: BulkPublishModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const availableProjects = projects.filter((p) => p.id !== sourceProjectId);

  const handleBulkPublish = async () => {
    if (!selectedProject) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await apiPost<{ created: number; skipped: number; total: number }>(
        `/api/projects/${sourceProjectId}/publish-all`,
        { targetProjectId: selectedProject, brandKitId: selectedBrand || null }
      );
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk publish failed');
    } finally {
      setBusy(false);
    }
  };

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Publish all guides to...</h2>
        <p className="text-xs text-gray-400 mb-4">
          Publish every guide in this project to another project. Content stays in sync — only branding changes.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Target project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-600"
            >
              <option value="">Select a project...</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brandKit ? `${p.brandKit.name} — ${p.name}` : p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Brand override (optional)</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-200 outline-none focus:border-blue-600"
            >
              <option value="">Use target project's brand</option>
              {brandKits.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {result && (
            <div className="rounded-lg bg-green-900/30 border border-green-700/40 px-3 py-2 text-sm text-green-300">
              Published {result.created} guide{result.created !== 1 ? 's' : ''}.
              {result.skipped > 0 && ` ${result.skipped} already published (skipped).`}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleBulkPublish}
              disabled={!selectedProject || busy}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {busy ? 'Publishing...' : 'Publish All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
