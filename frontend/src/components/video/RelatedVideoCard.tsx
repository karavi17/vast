import { VideoItem } from '@/types';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

interface RelatedVideoCardProps {
  video: VideoItem;
}

export const RelatedVideoCard = ({ video }: RelatedVideoCardProps) => {
  const thumbnail = video.thumbnail || video.cover?.url || video.stills?.url || '/placeholder.jpg';
  const duration = video.duration;
  const quality = video.quality || 'HD';

  return (
    <Link 
      href={`/watch?v=${video.subjectId}&type=${video.subjectType}`} 
      className="flex gap-3 group cursor-pointer"
    >
      <div className="relative w-40 aspect-video rounded-lg overflow-hidden bg-[#1a1a1a] flex-shrink-0">
        <img
          src={thumbnail}
          alt={video.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
        
        {duration ? (
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1 py-0.5 rounded">
            {duration}
          </div>
        ) : null}

        <div className="absolute top-1 right-1 bg-red-600/90 text-white text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider">
          {quality}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="text-white font-medium text-sm line-clamp-2 leading-tight mb-1 group-hover:text-blue-400 transition-colors">
          {video.title}
        </h3>
        
        <div className="flex flex-col text-[#aaaaaa] text-xs">
          <div className="flex items-center gap-1 hover:text-white transition-colors">
            <span>{video.subjectType === 1 ? 'Movie' : 'TV Series'}</span>
            <CheckCircle size={10} className="text-[#aaaaaa]" />
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <span>{video.year || '2024'}</span>
            {video.updateTime && (
              <span className="before:content-['•'] before:mr-1">
                {video.updateTime}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};
