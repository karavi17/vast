import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Play, Loader2 } from 'lucide-react';
import { deleteOfflineDownload, listOfflineDownloads, type OfflineDownloadMeta } from '@/lib/offlineDownloads';

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
    if (!window.confirm('Are you sure you want to delete this download?')) return;
    await deleteOfflineDownload(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="py-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6 px-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Downloads</h1>
          <div className="text-sm text-[#aaaaaa] mt-1">
            {items.length} video{items.length === 1 ? '' : 's'} • {formatBytes(totalSize)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-[#aaaaaa]">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
          <p>Loading downloads...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="mx-2 bg-[#1a1a1a] border border-[#303030] rounded-xl p-10 text-center text-[#aaaaaa]">
          <p className="text-lg font-medium mb-1">No downloads yet</p>
          <p className="text-sm">Videos you download will appear here.</p>
          <Link to="/" className="inline-block mt-4 text-blue-400 hover:underline">
            Go to Home
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 px-2">
          {items.map((it) => (
            <div key={it.id} className="bg-[#1a1a1a] border border-[#303030] rounded-xl overflow-hidden group">
              <div className="relative aspect-video bg-black">
                {it.thumbnail ? (
                  <img src={it.thumbnail} alt={it.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#aaaaaa]">No thumbnail</div>
                )}
                <Link
                  to={`/watch?downloadId=${encodeURIComponent(it.id)}&type=1`}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center border border-white/20 transform group-hover:scale-110 transition-transform">
                    <Play size={24} className="text-white ml-1" />
                  </div>
                </Link>
              </div>

              <div className="p-4">
                <div className="text-white font-semibold line-clamp-2 min-h-[3rem]">{it.title}</div>
                <div className="text-xs text-[#aaaaaa] mt-2 flex flex-wrap gap-x-2">
                  {it.language && <span className="uppercase">{it.language}</span>}
                  {it.quality && <span className="before:content-['•'] before:mr-2">{it.quality}</span>}
                  <span className="before:content-['•'] before:mr-2">{formatBytes(it.size)}</span>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <Link
                    to={`/watch?downloadId=${encodeURIComponent(it.id)}&type=1`}
                    className="flex-1 bg-white text-black hover:bg-zinc-200 text-sm font-bold px-3 py-2 rounded-lg text-center transition-colors"
                  >
                    Play
                  </Link>
                  <button
                    onClick={() => void handleDelete(it.id)}
                    className="w-10 h-10 flex items-center justify-center bg-[#272727] hover:bg-red-600/20 hover:text-red-500 text-white rounded-lg transition-colors"
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
