'use client';

import { useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Code2, FileText, FileType, Globe } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { IconTile } from '@/components/ui/icon-tile';
import { useApi } from '@/hooks/use-api';

type ExportFormat = 'html' | 'embed' | 'pdf' | 'docx';

interface ExportOption {
  id: ExportFormat;
  name: string;
  description: string;
  icon: LucideIcon;
}

const exportOptions: ExportOption[] = [
  {
    id: 'html',
    name: 'HTML (Standalone)',
    description: 'Self-contained HTML page with all styles included -- ready to host or share',
    icon: Globe,
  },
  {
    id: 'embed',
    name: 'HTML (Embeddable)',
    description: 'HTML + CSS snippet you can paste into any website, CMS, or knowledge base',
    icon: Code2,
  },
  {
    id: 'pdf',
    name: 'PDF Document',
    description: 'Printable PDF with steps and screenshots (PNG or JPEG)',
    icon: FileText,
  },
  {
    id: 'docx',
    name: 'Word Document',
    description: 'Editable .docx with steps and embedded screenshots',
    icon: FileType,
  },
];

interface Guide {
  id: string;
  title: string;
  _count: { steps: number };
}

export function ExportPage() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [selectedGuideId, setSelectedGuideId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const { data: guides } = useApi<Guide[]>({ url: '/api/guides' });

  const selectedGuide = guides?.find((g) => g.id === selectedGuideId);

  const handleExport = async () => {
    if (!selectedFormat || !selectedGuideId) return;
    setExporting(true);
    setEmbedCode(null);

    try {
      const safeName = (selectedGuide?.title || 'guide').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

      if (selectedFormat === 'html') {
        const res = await fetch(`/api/guides/${selectedGuideId}/export?format=html&mode=download&scope=all`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.html`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (selectedFormat === 'pdf') {
        const res = await fetch(`/api/guides/${selectedGuideId}/export?format=pdf&scope=all`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (selectedFormat === 'docx') {
        const res = await fetch(`/api/guides/${selectedGuideId}/export?format=docx&scope=all`);
        if (!res.ok) throw new Error('Export failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (selectedFormat === 'embed') {
        const res = await fetch(`/api/guides/${selectedGuideId}/export?format=html&mode=snippet&scope=all`);
        if (!res.ok) throw new Error('Export failed');
        const data = await res.json();
        setEmbedCode(data.html);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handlePreview = () => {
    if (!selectedGuideId) return;
    window.open(`/api/guides/${selectedGuideId}/export?format=html&mode=standalone&scope=all`, '_blank');
  };

  const handleCopyEmbed = () => {
    if (!embedCode) return;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
        <div className="p-8 max-w-5xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold">Export</h2>
            <p className="text-gray-400 mt-1">Export your guides in multiple formats</p>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Choose a guide to export
            </h3>
            <select
              value={selectedGuideId}
              onChange={(e) => { setSelectedGuideId(e.target.value); setEmbedCode(null); }}
              className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-gray-200 outline-none focus:border-brand-600"
            >
              <option value="">Select a guide...</option>
              {guides?.map((g) => (
                <option key={g.id} value={g.id}>{g.title} ({g._count.steps} steps)</option>
              ))}
            </select>
          </div>

          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Export Format
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {exportOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => { setSelectedFormat(option.id); setEmbedCode(null); }}
                className={`card text-left transition-all cursor-pointer ${
                  selectedFormat === option.id
                    ? 'border-brand-600 bg-brand-600/5'
                    : 'hover:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <IconTile icon={option.icon} size="lg" variant="brand" />
                  <div>
                    <h4 className="font-semibold text-gray-200">{option.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedFormat && selectedGuideId && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">
                  {selectedFormat === 'html' && 'Download HTML'}
                  {selectedFormat === 'pdf' && 'Download PDF'}
                  {selectedFormat === 'docx' && 'Download Word'}
                  {selectedFormat === 'embed' && 'Get Embed Code'}
                </h3>
                {(selectedFormat === 'html' || selectedFormat === 'embed') && (
                  <button
                    onClick={handlePreview}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Preview in new tab
                  </button>
                )}
              </div>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="btn-primary disabled:opacity-50"
                >
                  {exporting
                    ? 'Generating...'
                    : selectedFormat === 'html'
                      ? 'Download HTML File'
                      : selectedFormat === 'pdf'
                        ? 'Download PDF'
                        : selectedFormat === 'docx'
                          ? 'Download Word (.docx)'
                          : 'Generate Embed Code'}
                </button>
              </div>

              {embedCode && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Copy this HTML into your website or CMS:</p>
                    <button
                      onClick={handleCopyEmbed}
                      className="text-sm px-3 py-1 rounded-lg bg-gray-800 text-gray-300 hover:text-white transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                  </div>
                  <pre className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                    {embedCode}
                  </pre>
                </div>
              )}
            </div>
          )}

          {selectedFormat && !selectedGuideId && (
            <div className="card p-8 text-center">
              <p className="text-gray-500">Select a guide above to export</p>
            </div>
          )}
        </div>
    </AppShell>
  );
}
