'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getHomepage, getTrending } from '@/lib/api';
import { VideoItem, VideoSection } from '@/types';
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
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  // Initial fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setPage(0);
        
        // Try to fetch homepage content
        try {
          const homeResponse = await getHomepage(language);
          if (homeResponse.status === 'success' && homeResponse.data.sections) {
            setSections(homeResponse.data.sections);
          } else {
            setSections([]);
          }
        } catch (homeErr) {
          setSections([]);
        }

        // Always fetch trending
        const trendingResponse = await getTrending(0, 24, language);
        if (trendingResponse.status === 'success' && trendingResponse.data.items) {
          setTrending(trendingResponse.data.items);
          setHasMore(trendingResponse.data.items.length >= 12);
        } else {
          setTrending([]);
          setHasMore(false);
        }
      } catch (err) {
        setError('Unable to load content. Please make sure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [language]);

  // Load more trending when page changes
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
            setHasMore(newItems.length >= 12);
          }
        }
      } catch (err) {
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
        <p className="text-lg font-medium">Fetching the latest content...</p>
      </div>
    );
  }

  if (error && sections.length === 0 && trending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white px-4">
        <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-[#333] max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
          <p className="text-[#aaaaaa] mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black font-bold py-2 px-6 rounded-full hover:bg-gray-200 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0">
      {/* Filters/Tags Bar */}
      <div className="sticky top-[56px] bg-[#0f0f0f] pt-1 pb-3 z-30 flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0 border-b border-[#272727] sm:border-none">
        {['All', 'Movies', 'TV Series', 'Trending', 'Recently Added', 'Popular', 'New Releases', 'Hindi', 'English'].map((tag) => (
          <button
            key={tag}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tag === 'All' ? 'bg-white text-black' : 'bg-[#272727] text-white hover:bg-[#3f3f3f]'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Render sections from homepage API if available */}
      {sections.map((section, idx) => (
        <VideoGrid key={idx} title={section.title} videos={section.items} />
      ))}

      {/* Render Trending as its own section or if sections are empty */}
      {(trending.length > 0 && sections.length === 0) && (
        <VideoGrid title="Trending Now" videos={trending} />
      )}
      
      {trending.length > 0 && sections.length > 0 && (
        <VideoGrid title="Recommended for You" videos={trending} />
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={lastElementRef} className="h-10 flex items-center justify-center mt-4">
        {loadingMore && <Loader2 className="w-8 h-8 animate-spin text-red-600" />}
        {!hasMore && trending.length > 0 && (
          <p className="text-[#aaaaaa] text-sm italic">No more recommendations to show.</p>
        )}
      </div>
    </div>
  );
}
