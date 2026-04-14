'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trash2, Play } from 'lucide-react';
import { deleteOfflineDownload, listOfflineDownloads, OfflineDownloadMeta } from '@/lib/offlineDownloads';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const rounded = i === 0 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded} ${units[i]}`;
}

export default function DownloadsPage() {
  const [items, setItems] = useState<OfflineDownloadMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const totalSize = useMemo(() => items.reduce((acc, it) => acc + (it.size || 0), 0), [items]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const list = await listOfflineDownloads();
        setItems(list);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function handleDelete(id: string) {
    await deleteOfflineDownload(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="py-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
          <div className="text-sm text-[#aaaaaa] mt-1">
            {items.length} video{items.length === 1 ? '' : 's'} • {formatBytes(totalSize)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-[#aaaaaa]">Loading downloads...</div>
      ) : items.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#303030] rounded-xl p-6 text-center text-[#aaaaaa]">
          No downloads yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.id} className="bg-[#1a1a1a] border border-[#303030] rounded-xl overflow-hidden">
              <div className="relative aspect-video bg-black">
                {it.thumbnail ? (
                  <img src={it.thumbnail} alt={it.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#aaaaaa]">No thumbnail</div>
                )}
                <Link
                  href={`/watch?downloadId=${encodeURIComponent(it.id)}&type=1`}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/35 transition-colors"
                >
                  <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center border border-white/20">
                    <Play size={26} className="text-white ml-1" />
                  </div>
                </Link>
              </div>

              <div className="p-4">
                <div className="text-white font-semibold line-clamp-2">{it.title}</div>
                <div className="text-xs text-[#aaaaaa] mt-1">
                  {it.language && it.language.toUpperCase() !== 'ENGLISH' ? `${it.language} • ` : ''}
                  {it.quality ? `${it.quality} • ` : ''}
                  {formatBytes(it.size)}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Link
                    href={`/watch?downloadId=${encodeURIComponent(it.id)}&type=1`}
                    className="flex-1 bg-[#272727] hover:bg-[#3f3f3f] text-white text-sm font-medium px-3 py-2 rounded-lg text-center"
                  >
                    Play
                  </Link>
                  <button
                    onClick={() => void handleDelete(it.id)}
                    className="w-10 h-10 flex items-center justify-center bg-[#272727] hover:bg-[#3f3f3f] text-white rounded-lg"
                    aria-label="Delete download"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

