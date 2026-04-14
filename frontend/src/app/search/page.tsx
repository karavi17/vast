'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { searchVideos } from '@/lib/api';
import { VideoItem } from '@/types';
import { VideoGrid } from '@/components/video/VideoGrid';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const { language } = useLanguage();
  
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
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

  // Initial search when query or language filter changes
  useEffect(() => {
    const fetchInitialResults = async () => {
      if (!query) return;
      
      try {
        setLoading(true);
        setError(null);
        setPage(1);
        const response = await searchVideos(query, 1, 24, language);
        if (response.status === 'success' && response.data.items) {
          setVideos(response.data.items);
          setHasMore(response.data.items.length >= 10);
        }
      } catch (err) {
        setError('Failed to fetch search results.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialResults();
  }, [query, language]);

  // Load more when page changes
  useEffect(() => {
    if (page === 1 || !query) return;

    const fetchMoreResults = async () => {
      try {
        setLoadingMore(true);
        const response = await searchVideos(query, page, 24, language);
        if (response.status === 'success' && response.data.items) {
          const newItems = response.data.items;
          if (newItems.length === 0) {
            setHasMore(false);
          } else {
            setVideos(prev => {
              const existingIds = new Set(prev.map(v => v.subjectId));
              const uniqueNewItems = newItems.filter(v => !existingIds.has(v.subjectId));
              return [...prev, ...uniqueNewItems];
            });
            setHasMore(newItems.length >= 10);
          }
        }
      } catch (err) {
      } finally {
        setLoadingMore(false);
      }
    };

    fetchMoreResults();
  }, [page, query, language]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
        <p className="text-lg font-medium">Searching for &quot;{query}&quot;...</p>
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <p className="text-lg text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-white text-xl font-bold">
          Search results for: <span className="text-[#aaaaaa]">&quot;{query}&quot;</span>
        </h1>
        {language !== 'RANDOM' && language !== 'ENGLISH' && (
          <div className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            Filtered by: {language}
          </div>
        )}
      </div>
      
      <VideoGrid videos={videos} />
      
      {/* Sentinel for infinite scroll */}
      <div ref={lastElementRef} className="h-10 flex items-center justify-center mt-4">
        {loadingMore && <Loader2 className="w-8 h-8 animate-spin text-red-600" />}
        {!hasMore && videos.length > 0 && (
          <p className="text-[#aaaaaa] text-sm italic">No more results to show.</p>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
      </div>
    }>
      <SearchResults />
    </Suspense>
  );
}
