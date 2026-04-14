import { VideoItem } from '@/types';
import { MoreVertical, CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface VideoCardProps {
  video: VideoItem;
}

export const VideoCard = ({ video }: VideoCardProps) => {
  const thumbnail = video.thumbnail || video.cover?.url || video.stills?.url || '/placeholder.jpg';
  
  // Format duration (e.g., "1:23:45" or "10:30")
  const duration = video.duration;
  
  // Get language badges
  const languages = video.languages || [];
  
  // Quality tag
  const quality = video.quality || 'HD'; // Fallback if not available

  return (
    <Link href={`/watch?v=${video.subjectId}&type=${video.subjectType}`} className="flex flex-col gap-2 sm:gap-3 group cursor-pointer">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1a1a1a] flex-shrink-0">
        <img
          src={thumbnail}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
        
        {/* Duration badge */}
        {duration ? (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded-md">
            {duration}
          </div>
        ) : null}

        {/* Quality badge (top right) */}
        <div className="absolute top-1 right-1 bg-red-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
          {quality}
        </div>

        {/* Language badges (top left) */}
        {languages.length > 0 && (
          <div className="absolute top-1 left-1 flex flex-wrap gap-1 max-w-[80%]">
            {languages
              .filter((lang) => lang.toUpperCase() !== 'ENGLISH')
              .map((lang) => (
                <span
                  key={lang}
                  className="bg-blue-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
                >
                  {lang}
                </span>
              ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 sm:gap-3 px-1 sm:px-1">
        <div className="flex-shrink-0">
          <div className="w-9 h-9 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm sm:text-sm">
            {video.title.charAt(0)}
          </div>
        </div>
        
        <div className="flex flex-col flex-1 pr-4 relative">
          <h3 className="text-white font-semibold text-sm sm:text-sm line-clamp-2 leading-tight mb-1 group-hover:text-blue-400 transition-colors">
            {video.title}
          </h3>
          
          <div className="flex flex-col text-[#aaaaaa] text-xs sm:text-xs">
            <div className="flex items-center gap-1 hover:text-white transition-colors">
              <span>{video.subjectType === 1 ? 'Movie' : 'TV Series'}</span>
              <CheckCircle size={12} className="text-[#aaaaaa] sm:w-3 sm:h-3" />
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span>{video.year || '2024'}</span>
              <span className="before:content-['•'] before:mr-1">
                {video.updateTime || 'Recently added'}
              </span>
            </div>
          </div>

          <button className="absolute top-0 right-[-8px] sm:right-[-8px] p-1 text-transparent group-hover:text-[#aaaaaa] hover:text-white rounded-full hover:bg-[#272727] transition-all">
            <MoreVertical size={20} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </Link>
  );
};
