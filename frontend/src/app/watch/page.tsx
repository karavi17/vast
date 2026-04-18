'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getVideoInfo, getVideoSources, getRelatedVideos } from '@/lib/api';
import { VideoItem, Subtitle, SourcesResponseData } from '@/types';
import { Loader2, Share2, Download, MoreVertical, ChevronDown, List as ListIcon } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { YoutubePlayer } from '@/components/video/YoutubePlayer';
import { RelatedVideoCard } from '@/components/video/RelatedVideoCard';
import { getOfflineDownloadBlobUrl, getOfflineDownloadMeta, saveOfflineDownload } from '@/lib/offlineDownloads';

interface Source {
  id: string;
  quality: string;
  language: string;
  directUrl: string;
  downloadUrl: string;
  streamUrl: string;
  size?: number;
  format: string;
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function WatchVideo() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get('v');
  const type = searchParams.get('type') || '1'; // Default to Movie
  const downloadId = searchParams.get('downloadId');
  
  const [videoInfo, setVideoInfo] = useState<VideoItem | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<VideoItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(0);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const offlineRevokeRef = useRef<(() => void) | null>(null);
  
  const { language, setLanguage } = useLanguage();

  const selectedSource = useMemo(
    () => sources.find((s) => s.id === selectedSourceId) ?? null,
    [sources, selectedSourceId]
  );

  const seasons = useMemo(() => {
    if (!videoInfo?.episodeList) return [];
    const sSet = new Set(videoInfo.episodeList.map(ep => ep.season));
    return Array.from(sSet).sort((a, b) => a - b);
  }, [videoInfo]);

  const episodesInSelectedSeason = useMemo(() => {
    if (!videoInfo?.episodeList || selectedSeason === 0) return [];
    return videoInfo.episodeList
      .filter(ep => ep.season === selectedSeason)
      .sort((a, b) => a.episode - b.episode);
  }, [videoInfo, selectedSeason]);

  const seededUi = useMemo(() => {
    const seed = (downloadId || videoId || 'seed')
      .split('')
      .reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const views = 50_000 + (seed % 9_500_000);
    const likes = 1_000 + (seed % 340_000);
    const daysAgo = 1 + (seed % 45);
    return { views, likes, daysAgo };
  }, [videoId, downloadId]);

  useEffect(() => {
    const fetchVideoData = async () => {
      if (!videoId && !downloadId) return;

      try {
        const isInitialLoad = !videoInfo || videoInfo.subjectId !== videoId;
        
        if (downloadId) {
          // Only process offline if it's the first load or downloadId changed
          if (isInitialLoad) {
            setLoading(true);
            setError(null);
            const meta = await getOfflineDownloadMeta(downloadId);
            if (!meta) {
              setError('Downloaded video not found.');
              setLoading(false);
              return;
            }
            const blob = await getOfflineDownloadBlobUrl(downloadId);
            if (!blob) {
              setError('Failed to open downloaded video.');
              setLoading(false);
              return;
            }
            if (offlineRevokeRef.current) offlineRevokeRef.current();
            offlineRevokeRef.current = blob.revoke;
            setVideoInfo({
              subjectId: meta.videoId,
              subjectType: Number(type || 1),
              title: meta.title,
              thumbnail: meta.thumbnail,
              languages: meta.language ? [meta.language] : undefined,
              quality: meta.quality,
            });
            setSources([
              {
                id: meta.id,
                quality: meta.quality || 'Offline',
                language: meta.language || 'Offline',
                directUrl: blob.url,
                downloadUrl: '',
                streamUrl: blob.url,
                format: meta.mimeType || 'video/mp4',
              },
            ]);
            setSelectedSourceId(meta.id);
            setIsDownloaded(true);
            setLoading(false);
          }
          return;
        }

        if (!videoId) {
          setError('Video not found');
          setLoading(false);
          return;
        }
        const vId = videoId;

        // Fetch sources and related videos on every change
        // Fetch info only on initial load
        if (isInitialLoad) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingSources(true);
        }

        const requests: Promise<any>[] = [
          getVideoSources(vId, selectedSeason, selectedEpisode),
          getRelatedVideos(vId, language)
        ];
        
        if (isInitialLoad) {
          requests.unshift(getVideoInfo(vId));
        }

        const results = await Promise.allSettled(requests);
        
        let infoResult, sourcesResult, relatedResult;
        if (isInitialLoad) {
          [infoResult, sourcesResult, relatedResult] = results;
        } else {
          [sourcesResult, relatedResult] = results;
        }

        // Process Info
        if (isInitialLoad) {
          if (infoResult.status === 'fulfilled' && infoResult.value.status === 'success' && infoResult.value.data.subject) {
            const currentSubject = infoResult.value.data.subject;
            setVideoInfo(currentSubject);
            if (currentSubject.subjectType === 2 && currentSubject.episodeList?.length > 0) {
              if (selectedSeason === 0 || selectedEpisode === 0) {
                const firstEp = currentSubject.episodeList[0];
                setSelectedSeason(firstEp.season);
                setSelectedEpisode(firstEp.episode);
              }
            }
          } else {
            setError('Failed to load video info.');
            setLoading(false);
            setLoadingSources(false);
            return;
          }
        }

        // Process Sources
        if (sourcesResult.status === 'fulfilled' && sourcesResult.value.status === 'success') {
          const sourcesData = sourcesResult.value.data as SourcesResponseData;
          if (sourcesData.processedSources) {
            const availableSources = sourcesData.processedSources;
            setSources(availableSources);
            if (availableSources.length > 0) {
              let preferredSource = availableSources[0];
              if (language === 'HINDI') {
                preferredSource = availableSources.find((s) => s.language.toUpperCase().includes('HINDI')) || preferredSource;
              } else if (language === 'ENGLISH') {
                preferredSource = availableSources.find((s) => s.language.toUpperCase().includes('ENGLISH')) || preferredSource;
              }
              setSelectedSourceId(preferredSource.id);
            }
          }
          if (sourcesData.processedSubtitles) {
            setSubtitles(sourcesData.processedSubtitles);
          }
        }

        // Process Related
        if (relatedResult.status === 'fulfilled' && relatedResult.value.status === 'success') {
          setRelatedVideos(relatedResult.value.data.items);
        } else {
          setRelatedVideos([]);
        }

        setLoading(false);
        setLoadingSources(false);

      } catch {
        setError('Failed to load video. Please try again later.');
        setLoading(false);
        setLoadingSources(false);
      }
    };

    fetchVideoData();
  }, [videoId, language, downloadId, type, selectedSeason, selectedEpisode]);

  useEffect(() => {
    return () => {
      if (offlineRevokeRef.current) offlineRevokeRef.current();
    };
  }, []);

  useEffect(() => {
    const checkDownloaded = async () => {
      if (!videoId || !selectedSourceId) return;
      const id = `${videoId}:${selectedSourceId}`;
      const meta = await getOfflineDownloadMeta(id);
      setIsDownloaded(Boolean(meta));
    };
    void checkDownloaded();
  }, [videoId, selectedSourceId]);

  async function handleOfflineDownload() {
    if (!videoId || !selectedSource || !videoInfo) return;
    if (isDownloading) return;

    const recordId = `${videoId}:${selectedSource.id}`;
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      const url = selectedSource.downloadUrl || selectedSource.streamUrl;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);

      const contentLength = Number(response.headers.get('content-length') || 0);
      const mimeType = response.headers.get('content-type') || 'video/mp4';

      if (!response.body) {
        const bytes = await response.arrayBuffer();
        await saveOfflineDownload({
          id: recordId,
          videoId,
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail || videoInfo.cover?.url || videoInfo.stills?.url,
          language: selectedSource.language,
          quality: selectedSource.quality,
          mimeType,
          bytes,
        });
        setIsDownloaded(true);
        setDownloadProgress(null);
        return;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          if (contentLength > 0) setDownloadProgress(Math.round((received / contentLength) * 100));
        }
      }

      const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }

      await saveOfflineDownload({
        id: recordId,
        videoId,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail || videoInfo.cover?.url || videoInfo.stills?.url,
        language: selectedSource.language,
        quality: selectedSource.quality,
        mimeType,
        bytes: merged.buffer,
      });

      setIsDownloaded(true);
      setDownloadProgress(null);
    } catch {
      setError('Download failed. This source may block downloads in browser.');
      setDownloadProgress(null);
    } finally {
      setIsDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
        <p className="text-xl font-medium">Loading video...</p>
      </div>
    );
  }

  if (error || !videoInfo) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <p className="text-xl text-red-500 mb-4">{error || 'Video not found'}</p>
      </div>
    );
  }

  const playerSources = sources.map((s) => ({
    id: s.id,
    label: `${s.language} • ${s.quality}`,
    src: s.streamUrl,
    mimeType: 'video/mp4',
    language: s.language,
    quality: s.quality,
  }));

  return (
    <div className="py-6 px-4 md:px-0 max-w-[1600px] mx-auto flex flex-col xl:flex-row gap-6">
      
      {/* Main Video Section */}
      <div className="flex-1 min-w-0">
        
        {/* Video Player */}
        <div className="aspect-video w-full bg-black rounded-xl overflow-hidden mb-4 border border-[#303030] shadow-2xl relative">
          {loadingSources && sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#aaaaaa] bg-[#000000]">
              <div className="w-12 h-12 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium text-white">Fetching high-quality links...</p>
              <p className="text-sm mt-2 opacity-60">This usually takes a few seconds</p>
            </div>
          ) : sources.length > 0 ? (
            <YoutubePlayer
              poster={videoInfo.thumbnail || videoInfo.cover?.url || videoInfo.stills?.url}
              sources={playerSources}
              subtitles={subtitles}
              selectedSourceId={selectedSourceId || playerSources[0]?.id}
              onSelectSourceId={(id) => {
                setSelectedSourceId(id);
                // Also update the global language context if the selected source has a clear language
                const s = playerSources.find(p => p.id === id);
                if (s?.language) {
                  const upperLang = s.language.toUpperCase();
                  if (upperLang.includes('HINDI') && language !== 'HINDI') {
                    setLanguage('HINDI');
                  } else if (upperLang.includes('ENGLISH') && language !== 'ENGLISH') {
                    setLanguage('ENGLISH');
                  }
                }
              }}
              onDownload={!downloadId ? handleOfflineDownload : undefined}
              autoPlay
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#aaaaaa] bg-[#000000]">
              {error ? (
                 <div className="text-center p-6">
                    <p className="text-red-500 mb-4">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-black rounded-full font-bold">Retry</button>
                 </div>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-2" />
                  <p className="text-sm">Fetching sources...</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Video Title and Details */}
        <h1 className="text-xl md:text-2xl font-bold text-white mb-2 leading-tight">
          {videoInfo.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#aaaaaa] mb-4">
          <span>{seededUi.views.toLocaleString()} views</span>
          <span className="before:content-['•'] before:mr-2">{seededUi.daysAgo} days ago</span>
          {videoInfo.year ? <span className="before:content-['•'] before:mr-2">{videoInfo.year}</span> : null}
        </div>

        {/* Channel and Actions Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {videoInfo.title.charAt(0)}
            </div>
            <div>
              <h3 className="text-white font-semibold">{videoInfo.subjectType === 1 ? 'MovieBox Movies' : 'MovieBox TV'}</h3>
              <p className="text-[#aaaaaa] text-xs">1.2M subscribers</p>
            </div>
            <button className="ml-2 bg-white text-black font-semibold px-4 py-2 rounded-full hover:bg-gray-200 transition-colors">
              Subscribe
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0 min-h-[40px]">
            {/* Season and Episode Selection for TV Series */}
            {videoInfo.subjectType === 2 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Season Dropdown */}
                <div className="relative group">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#272727] hover:bg-[#3f3f3f] rounded-full text-white text-sm font-medium whitespace-nowrap transition-colors border border-transparent group-hover:border-white/10 pointer-events-none">
                    <span className="text-[#aaaaaa] mr-1">Season</span>
                    <span>{selectedSeason || 1}</span>
                    <ChevronDown size={14} className="text-[#aaaaaa] ml-1" />
                  </div>
                  <select
                    value={selectedSeason || 1}
                    onChange={(e) => {
                      const s = Number(e.target.value);
                      setSelectedSeason(s);
                      const firstEpInSeason = videoInfo.episodeList?.find(ep => ep.season === s);
                      if (firstEpInSeason) setSelectedEpisode(firstEpInSeason.episode);
                      else setSelectedEpisode(1);
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full [&_option]:bg-[#1f1f1f] [&_option]:text-white"
                    title="Select Season"
                  >
                    {seasons.length > 0 ? (
                      seasons.map(s => (
                        <option key={s} value={s}>Season {s}</option>
                      ))
                    ) : (
                      <option value={1}>Season 1</option>
                    )}
                  </select>
                </div>

                {/* Episode Dropdown */}
                <div className="relative group">
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#272727] hover:bg-[#3f3f3f] rounded-full text-white text-sm font-medium whitespace-nowrap transition-colors border border-transparent group-hover:border-white/10 pointer-events-none">
                    <ListIcon size={16} className="text-[#aaaaaa] mr-1" />
                    <span className="text-[#aaaaaa] mr-1">Episode</span>
                    <span>{selectedEpisode || 1}</span>
                    <ChevronDown size={14} className="text-[#aaaaaa] ml-1" />
                  </div>
                  <select
                    value={selectedEpisode || 1}
                    onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full [&_option]:bg-[#1f1f1f] [&_option]:text-white"
                    title="Select Episode"
                  >
                    {episodesInSelectedSeason.length > 0 ? (
                      episodesInSelectedSeason.map(ep => {
                        const epLabel = `Episode ${ep.episode}`;
                        const epTitle = ep.title && !ep.title.includes(`Episode ${ep.episode}`) 
                          ? ` - ${ep.title}` 
                          : '';
                        return (
                          <option key={ep.episodeId} value={ep.episode}>
                            {epLabel}{epTitle}
                          </option>
                        );
                      })
                    ) : (
                      <option value={1}>Episode 1</option>
                    )}
                  </select>
                </div>
              </div>
            )}

            <button className="flex items-center gap-2 px-4 py-2 bg-[#272727] hover:bg-[#3f3f3f] rounded-full text-white text-sm font-medium whitespace-nowrap flex-shrink-0">
              <Share2 size={18} />
              Share
            </button>

            {!downloadId ? (
              <button
                onClick={handleOfflineDownload}
                disabled={!selectedSource || isDownloading || isDownloaded}
                className={`flex items-center gap-2 px-4 py-2 bg-[#272727] hover:bg-[#3f3f3f] rounded-full text-white text-sm font-medium whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:hover:bg-[#272727] ${
                  isDownloaded ? 'border border-green-500/60' : ''
                }`}
              >
                <Download size={18} />
                {isDownloaded ? 'Downloaded' : isDownloading ? `Downloading${downloadProgress !== null ? ` ${downloadProgress}%` : ''}` : 'Download'}
              </button>
            ) : null}

            <button className="flex items-center justify-center w-9 h-9 bg-[#272727] hover:bg-[#3f3f3f] rounded-full text-white flex-shrink-0">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Description Box */}
        <div className="bg-[#272727] rounded-xl p-4 text-sm text-white">
          <div className="font-semibold mb-2">
            {videoInfo.year || videoInfo.releaseDate?.split('-')[0] || '2024'} • {videoInfo.duration && videoInfo.duration > 0 ? formatTime(videoInfo.duration) : videoInfo.subjectType === 2 ? 'TV Series' : 'Movie'} • {videoInfo.quality || 'HD'}
          </div>
          <p className="whitespace-pre-wrap leading-relaxed text-[#f1f1f1]">
            {videoInfo.synopsis || videoInfo.desc || `Watch ${videoInfo.title} in HD quality.`}
          </p>
        </div>

      </div>

      {/* Suggested Videos Sidebar */}
      <div className="xl:w-[400px] flex-shrink-0">
        <h3 className="text-white font-bold text-lg mb-4 hidden xl:block">Up next</h3>
        <div className="flex flex-col gap-3">
          {relatedVideos.length > 0 ? (
            relatedVideos.map((video, index) => (
              <RelatedVideoCard key={`${video.subjectId}-${index}`} video={video} />
            ))
          ) : (
            <div className="text-[#aaaaaa] text-sm p-4 bg-[#1a1a1a] rounded-xl text-center border border-[#303030]">
              No related videos found.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <Loader2 className="w-12 h-12 animate-spin text-red-600 mb-4" />
      </div>
    }>
      <WatchVideo />
    </Suspense>
  );
}
