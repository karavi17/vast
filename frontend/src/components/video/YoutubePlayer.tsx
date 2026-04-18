'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MoreVertical, Volume2, VolumeX, Maximize, Minimize, Play, Pause, Captions } from 'lucide-react';
import { Subtitle } from '@/types';

export type PlayerSource = {
  id: string;
  label: string;
  src: string;
  mimeType?: string;
  language?: string;
  quality?: string;
};

type MenuView = 'root' | 'speed' | 'quality' | 'language' | 'subtitles';

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function YoutubePlayer(props: {
  poster?: string;
  sources: PlayerSource[];
  subtitles?: Subtitle[];
  selectedSourceId: string;
  onSelectSourceId: (id: string) => void;
  onDownload?: () => void;
  autoPlay?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  const selected = useMemo(
    () => props.sources.find((s) => s.id === props.selectedSourceId) ?? props.sources[0],
    [props.sources, props.selectedSourceId]
  );

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('root');
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>('none');
  const [ccEnabled, setCcEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTimeRef = useRef(currentTime);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const toggleCC = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;

    const nextEnabled = !ccEnabled;
    setCcEnabled(nextEnabled);

    const tracks = el.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (nextEnabled) {
        if (selectedSubtitleId === 'none' || selectedSubtitleId === '') {
          if (i === 0) {
            tracks[i].mode = 'showing';
            setSelectedSubtitleId(props.subtitles?.[0]?.id || 'none');
          } else {
            tracks[i].mode = 'hidden';
          }
        } else {
          tracks[i].mode = (props.subtitles?.[i]?.id === selectedSubtitleId) ? 'showing' : 'hidden';
        }
      } else {
        tracks[i].mode = 'disabled';
      }
    }
  }, [ccEnabled, selectedSubtitleId, props.subtitles]);

  const setSubtitle = useCallback((subId: string) => {
    const el = videoRef.current;
    if (!el) return;

    setSelectedSubtitleId(subId);
    if (subId === 'none') {
      setCcEnabled(false);
    } else {
      setCcEnabled(true);
    }

    const tracks = el.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (subId === 'none') {
        tracks[i].mode = 'disabled';
      } else {
        tracks[i].mode = (props.subtitles?.[i]?.id === subId) ? 'showing' : 'hidden';
      }
    }
  }, [props.subtitles]);

  const setSpeed = useCallback((rate: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  // Reset CC state when sources change significantly
  useEffect(() => {
    if (props.subtitles && props.subtitles.length > 0) {
    } else {
      setSelectedSubtitleId('none');
      setCcEnabled(false);
    }
  }, [props.subtitles]);

  const playbackRates = useMemo(() => [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2], []);

  const uniqueLanguages = useMemo(() => {
    const langs = new Set<string>();
    props.sources.forEach(s => {
      if (s.language) langs.add(s.language);
    });
    return Array.from(langs).sort();
  }, [props.sources]);

  const qualitiesForSelectedLanguage = useMemo(() => {
    if (!selected?.language) return props.sources;
    return props.sources.filter(s => s.language === selected.language);
  }, [props.sources, selected]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    setError(null);
    // Preserve time when source changes
    if (currentTimeRef.current > 0 && Math.abs(el.currentTime - currentTimeRef.current) > 1) {
      el.currentTime = currentTimeRef.current;
    }

    if (el.readyState >= 1) {
      setDuration(el.duration || 0);
    }
    if (el.readyState >= 2) {
      setIsReady(true);
    }

    const onLoadedMetadata = () => {
      setDuration(el.duration || 0);
      setIsReady(true);
      if (isPlayingRef.current || props.autoPlay) {
        void el.play().catch(() => {
          // Auto-play might be blocked by browser
          setIsPlaying(false);
        });
      }
    };
    const onCanPlay = () => setIsReady(true);
    const onTimeUpdate = () => setCurrentTime(el.currentTime || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = (e: any) => {
      console.error('Video Error:', el.error);
      setIsReady(false);
      setError('Video playback failed. This could be due to an expired link or network error. Please try another quality or refresh.');
    };
    const onVolumeChange = () => {
      setIsMuted(el.muted);
      setVolume(el.volume);
    };
    const onRateChange = () => setPlaybackRate(el.playbackRate);

    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('error', onError);
    el.addEventListener('volumechange', onVolumeChange);
    el.addEventListener('ratechange', onRateChange);

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('error', onError);
      el.removeEventListener('volumechange', onVolumeChange);
      el.removeEventListener('ratechange', onRateChange);
    };
  }, [selected?.src, props.autoPlay]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = videoRef.current;
      if (!el) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (el.paused) el.play();
        else el.pause();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        el.currentTime = Math.max(0, el.currentTime - 5);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        el.currentTime = Math.min(el.duration || el.currentTime + 5, el.currentTime + 5);
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void toggleFullscreen();
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleCC();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCC, toggleFullscreen]);

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideControlsTimerRef.current = window.setTimeout(() => {
      setShowControls(false);
      setMenuOpen(false);
    }, 2200);
  }, [clearHideTimer]);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (!menuOpen) scheduleHide();
  }, [menuOpen, scheduleHide]);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch((err) => {
        console.error('Manual Play error:', err);
      });
    } else {
      el.pause();
    }
  }, []);

  const setMuted = useCallback((nextMuted: boolean) => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const setVolumeValue = useCallback((nextVolume: number) => {
    const el = videoRef.current;
    if (!el) return;
    const v = clamp(nextVolume, 0, 1);
    el.volume = v;
    if (v > 0 && el.muted) el.muted = false;
    setVolume(v);
  }, []);

  const seekToRatio = useCallback((ratio: number) => {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = clamp(ratio, 0, 1) * el.duration;
  }, []);

  const openMenu = useCallback(() => {
    setShowControls(true);
    setMenuOpen(true);
    setMenuView('root');
    clearHideTimer();
  }, [clearHideTimer]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuView('root');
    scheduleHide();
  }, [scheduleHide]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (!menuOpen) scheduleHide();
      }}
      onClick={() => {
        if (menuOpen) closeMenu();
      }}
    >
      <video
        ref={videoRef}
        className="w-full h-full outline-none"
        src={selected?.src}
        poster={props.poster}
        autoPlay={props.autoPlay}
        crossOrigin="anonymous"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
      >
        {/* Dynamic Subtitle Tracks */}
        {props.subtitles?.map((sub) => (
          <track
            key={sub.id}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.lang}
            label={sub.label}
            default={selectedSubtitleId === sub.id}
          />
        ))}
      </video>

      {/* Center Play/Pause button for better feedback */}
      {!isPlaying && !error && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center text-white backdrop-blur-sm">
            <Play size={32} className="ml-1 fill-white" />
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-6 text-center z-50">
          <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
            <VolumeX size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold mb-2">Playback Error</h3>
          <p className="text-sm text-gray-300 max-w-xs mb-6">
            {error}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full font-medium transition-colors"
            >
              Refresh Page
            </button>
            <button 
              onClick={() => setMenuView('quality')}
              className="px-6 py-2 bg-[#272727] hover:bg-[#3f3f3f] rounded-full font-medium transition-colors"
            >
              Change Quality
            </button>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-10 h-10 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
        </div>
      )}

      <div
        className={`absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="range"
          min={0}
          max={1000}
          value={duration > 0 ? Math.floor((currentTime / duration) * 1000) : 0}
          onChange={(e) => {
            const ratio = Number(e.target.value) / 1000;
            seekToRatio(ratio);
          }}
          className="w-full accent-red-600 h-1"
        />

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
            </button>

            <button
              onClick={() => setMuted(!isMuted)}
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>

            <div className="hidden sm:flex items-center w-24">
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : Math.round(volume * 100)}
                onChange={(e) => setVolumeValue(Number(e.target.value) / 100)}
                className="w-full accent-white h-1"
              />
            </div>

            <div className="text-white text-xs tabular-nums ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {props.subtitles && props.subtitles.length > 0 && (
              <button
                onClick={toggleCC}
                className={`w-9 h-9 flex items-center justify-center transition-colors rounded-full ${
                  ccEnabled ? 'text-red-600' : 'text-white'
                } hover:bg-white/10`}
                title="Captions (c)"
              >
                <Captions size={20} />
                {ccEnabled && <div className="absolute bottom-1 w-1 h-1 bg-red-600 rounded-full" />}
              </button>
            )}

            <button
              onClick={() => (menuOpen ? closeMenu() : openMenu())}
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <MoreVertical size={20} />
            </button>

            <button
              onClick={() => void toggleFullscreen()}
              className="w-9 h-9 flex items-center justify-center text-white hover:bg-white/10 rounded-full transition-colors"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div
          className="absolute right-3 bottom-14 w-64 bg-[#1f1f1f] border border-[#303030] rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {menuView === 'root' ? (
            <div className="py-2">
              {props.onDownload ? (
                <button
                  onClick={() => {
                    closeMenu();
                    props.onDownload?.();
                  }}
                  className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors"
                >
                  Download
                </button>
              ) : null}
              <button
                onClick={() => setMenuView('speed')}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-between"
              >
                <span>Playback speed</span>
                <span className="text-[#aaaaaa] text-sm">{playbackRate === 1 ? 'Normal' : `${playbackRate}x`}</span>
              </button>
              {uniqueLanguages.length > 0 ? (
                <button
                  onClick={() => setMenuView('language')}
                  className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-between"
                >
                  <span>Audio Language</span>
                  <span className="text-[#aaaaaa] text-sm">{selected?.language ?? 'Default'}</span>
                </button>
              ) : null}
              <button
                onClick={() => setMenuView('quality')}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-between"
              >
                <span>Quality</span>
                <span className="text-[#aaaaaa] text-sm">{selected?.quality ?? selected?.label ?? 'Auto'}</span>
              </button>
              {props.subtitles && props.subtitles.length > 0 && (
                <button
                  onClick={() => setMenuView('subtitles')}
                  className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors flex items-center justify-between"
                >
                  <span>Subtitles</span>
                  <span className="text-[#aaaaaa] text-sm">
                    {selectedSubtitleId === 'none' ? 'Off' : (props.subtitles.find(s => s.id === selectedSubtitleId)?.label || 'On')}
                  </span>
                </button>
              )}
            </div>
          ) : null}

          {menuView === 'speed' ? (
            <div className="py-2">
              <button
                onClick={() => setMenuView('root')}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors"
              >
                Back
              </button>
              {playbackRates.map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setSpeed(rate);
                    closeMenu();
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors ${
                    playbackRate === rate ? 'text-blue-400 font-semibold' : 'text-white'
                  }`}
                >
                  {rate === 1 ? 'Normal' : `${rate}x`}
                </button>
              ))}
            </div>
          ) : null}

          {menuView === 'language' ? (
            <div className="py-2">
              <button
                onClick={() => setMenuView('root')}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors"
              >
                Back
              </button>
              {uniqueLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    // Find a source with this language, ideally matching current quality
                    const matchingQualitySource = props.sources.find(
                      (s) => s.language === lang && s.quality === selected?.quality
                    );
                    const newSource = matchingQualitySource || props.sources.find((s) => s.language === lang);
                    if (newSource) {
                      props.onSelectSourceId(newSource.id);
                    }
                    closeMenu();
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors ${
                    selected?.language === lang ? 'text-blue-400 font-semibold' : 'text-white'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          ) : null}

          {menuView === 'subtitles' ? (
            <div className="py-2">
              <button
                onClick={() => setMenuView('root')}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setSubtitle('none');
                  closeMenu();
                }}
                className={`w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors ${
                  selectedSubtitleId === 'none' ? 'text-blue-400 font-semibold' : 'text-white'
                }`}
              >
                Off
              </button>
              {props.subtitles?.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setSubtitle(sub.id);
                    closeMenu();
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors ${
                    selectedSubtitleId === sub.id ? 'text-blue-400 font-semibold' : 'text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          ) : null}

          {menuView === 'quality' ? (
            <div className="py-2">
              <button
                onClick={() => setMenuView('root')}
                className="w-full px-4 py-3 text-left text-white hover:bg-[#2a2a2a] transition-colors"
              >
                Back
              </button>
              {qualitiesForSelectedLanguage.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    props.onSelectSourceId(s.id);
                    closeMenu();
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-[#2a2a2a] transition-colors ${
                    props.selectedSourceId === s.id ? 'text-blue-400 font-semibold' : 'text-white'
                  }`}
                >
                  {s.quality ?? s.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!isReady ? (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : null}
    </div>
  );
}
