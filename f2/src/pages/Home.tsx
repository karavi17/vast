import { useEffect, useState, useRef, useCallback } from 'react';
import { getHomepage, getTrending } from '@/lib/api';
import type { VideoItem, VideoSection } from '@/types';
import { VideoGrid } from '@/components/video/VideoGrid';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Home() {
  const [sections, setSections] = useState<VideoSection[]>([]);
  const [trending, setTrending] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { language } = useLanguage();

  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    }, { rootMargin: '400px' });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  // Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setPage(0);
        
        const [homeResponse, trendingResponse] = await Promise.allSettled([
          getHomepage(language),
          getTrending(0, 24, language)
        ]);
        
        if (homeResponse.status === 'fulfilled' && homeResponse.value.status === 'success' && homeResponse.value.data.sections) {
          setSections(homeResponse.value.data.sections);
        } else {
          setSections([]);
        }

        if (trendingResponse.status === 'fulfilled' && trendingResponse.value.status === 'success' && trendingResponse.value.data.items) {
          setTrending(trendingResponse.value.data.items);
          setHasMore(trendingResponse.value.data.items.length >= 20);
        } else {
          setTrending([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error(err);
        setError('Unable to load content. Please make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [language]);

  useEffect(() => {
    if (page === 0) return;

    const fetchMoreTrending = async () => {
      try {
        setLoadingMore(true);
        const response = await getTrending(page, 24, language);
        if (response.status === 'success' && response.data.items) {
          const newItems = response.data.items;
          if (newItems.length === 0) {
            setHasMore(false);
          } else {
            setTrending(prev => {
              const existingIds = new Set(prev.map(v => v.subjectId));
              const uniqueNewItems = newItems.filter(v => !existingIds.has(v.subjectId));
              return [...prev, ...uniqueNewItems];
            });
            setHasMore(newItems.length >= 20);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMore(false);
      }
    };

    fetchMoreTrending();
  }, [page, language]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
        <p className="text-lg font-medium">Loading content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white px-4 text-center">
        <p className="text-lg text-red-500 mb-2">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((section, idx) => (
        <VideoGrid key={`${section.title}-${idx}`} title={section.title} videos={section.title === 'Recommendation' ? section.items.slice(0, 10) : section.items} />
      ))}
      
      <VideoGrid title="Trending Now" videos={trending} />
      
      <div ref={lastElementRef} className="h-20 flex items-center justify-center">
        {loadingMore && <Loader2 className="w-8 h-8 animate-spin text-red-600" />}
        {!hasMore && trending.length > 0 && (
          <p className="text-[#aaaaaa] text-sm italic">You've reached the end of the list.</p>
        )}
      </div>
    </div>
  );
}
