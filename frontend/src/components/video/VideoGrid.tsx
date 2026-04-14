import { VideoItem } from '@/types';
import { VideoCard } from './VideoCard';

interface VideoGridProps {
  videos: VideoItem[];
  title?: string;
}

export const VideoGrid = ({ videos, title }: VideoGridProps) => {
  if (!videos || videos.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-white">
        <div className="text-center">
          <p className="text-lg font-medium">No videos found</p>
          <p className="text-sm text-[#aaaaaa]">Try searching for something else</p>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-6 sm:mb-10 min-w-0 pt-4 sm:pt-6">
      {title && (
        <h2 className="text-white text-base sm:text-xl font-bold mb-3 sm:mb-6 flex items-center gap-2 px-2 sm:px-0 sticky top-[112px] sm:static bg-[#0f0f0f] py-2 z-20">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-4 gap-y-8 sm:gap-y-10">
        {videos.map((video, index) => (
          <VideoCard key={`${video.subjectId}-${index}`} video={video} />
        ))}
      </div>
    </section>
  );
};
