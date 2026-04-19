import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, Maximize, Minimize, Play, Pause } from 'lucide-react';
import type { Subtitle } from '@/types';

export type PlayerSource = {
  id: string;
  label: string;
  src: string;
  mimeType?: string;
  language?: string;
  quality?: string;
};

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function YoutubePlayer(props: {
  poster?: string;
  sources: PlayerSource[];
  subtitles?: Subtitle[];
  selectedSourceId: string;
  onSelectSourceId: (id: string) => void;
  autoPlay?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => props.sources.find((s) => s.id === props.selectedSourceId) ?? props.sources[0],
    [props.sources, props.selectedSourceId]
  );

  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Handle source change without losing progress
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !selected?.src) return;

    const restoreProgress = () => {
      if (currentTimeRef.current > 0) {
        el.currentTime = currentTimeRef.current;
      }
      if (isPlayingRef.current) {
        el.play().catch(() => setIsPlaying(false));
      }
    };

    el.addEventListener('loadedmetadata', restoreProgress);
    return () => el.removeEventListener('loadedmetadata', restoreProgress);
  }, [selected?.src]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => setCurrentTime(el.currentTime || 0);
    const onDurationChange = () => setDuration(el.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolumeChange = () => {
      setIsMuted(el.muted);
      setVolume(el.volume);
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('volumechange', onVolumeChange);

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    videoRef.current.muted = val === 0;
    setVolume(val);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative aspect-video bg-black group overflow-hidden rounded-xl">
      <video
        ref={videoRef}
        src={selected?.src}
        poster={props.poster}
        className="w-full h-full"
        autoPlay={props.autoPlay}
        playsInline
        crossOrigin="anonymous"
        onClick={togglePlay}
        onError={() => setError('Failed to load video.')}
      >
        {props.subtitles?.map(sub => (
          <track
            key={sub.id}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.lang}
            label={sub.label}
          />
        ))}
      </video>

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center">
          <p>{error}</p>
        </div>
      )}

      {/* Basic Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress Bar */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1 mb-4 accent-red-600 cursor-pointer"
        />

        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-red-600">
              {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
            </button>
            
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="hover:text-red-600">
                {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 opacity-0 pointer-events-none group-hover/volume:w-20 group-hover/volume:opacity-100 group-hover/volume:pointer-events-auto transition-all accent-red-600 cursor-pointer"
              />
            </div>

            <span className="text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <select 
              value={props.selectedSourceId} 
              onChange={(e) => props.onSelectSourceId(e.target.value)}
              className="bg-transparent text-sm border-none outline-none cursor-pointer"
            >
              {props.sources.map(s => (
                <option key={s.id} value={s.id} className="bg-zinc-900">
                  {s.label}
                </option>
              ))}
            </select>
            
            <button onClick={toggleFullscreen} className="hover:text-red-600">
              {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
