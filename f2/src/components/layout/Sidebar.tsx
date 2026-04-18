import { Home, Compass, PlaySquare, Clock, ThumbsUp, History, ChevronRight, Download, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUI } from '@/context/UIContext';

export const Sidebar = () => {
  const { isSidebarOpen, setSidebarOpen } = useUI();

  const primaryLinks = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Compass, label: 'Shorts', href: '/shorts' },
    { icon: PlaySquare, label: 'Subscriptions', href: '/subscriptions' },
  ];

  const libraryLinks = [
    { icon: History, label: 'History', href: '/history' },
    { icon: Clock, label: 'Watch later', href: '/watch-later' },
    { icon: ThumbsUp, label: 'Liked videos', href: '/liked' },
    { icon: Download, label: 'Downloads', href: '/downloads' },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 md:top-14 w-60 h-full md:h-[calc(100vh-56px)] bg-[#0f0f0f] overflow-y-auto z-50 md:z-40 transition-transform duration-300 ease-in-out custom-scrollbar pb-10 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Mobile Sidebar Header */}
        <div className="flex items-center h-14 px-4 md:hidden border-b border-[#303030] mb-2">
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 hover:bg-[#272727] rounded-full text-white mr-4"
          >
            <X size={24} />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="h-6 w-auto object-contain" />
            <span className="text-white font-bold text-xl tracking-tighter">VastWord</span>
          </Link>
        </div>

        <div className="py-2">
          {primaryLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="flex items-center gap-6 px-3 py-2 hover:bg-[#272727] rounded-lg mx-3 transition-colors text-white"
            >
              <link.icon size={24} />
              <span className="text-sm font-medium">{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="h-[1px] bg-[#303030] my-3 mx-3" />

        <div className="py-2">
          <Link to="/library" className="flex items-center gap-6 px-3 py-2 hover:bg-[#272727] rounded-lg mx-3 transition-colors text-white">
            <span className="text-base font-medium">You</span>
            <ChevronRight size={16} />
          </Link>
          {libraryLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="flex items-center gap-6 px-3 py-2 hover:bg-[#272727] rounded-lg mx-3 transition-colors text-white"
            >
              <link.icon size={24} />
              <span className="text-sm">{link.label}</span>
            </Link>
          ))}
        </div>

        <div className="h-[1px] bg-[#303030] my-3 mx-3" />

        <div className="py-2 px-6">
          <h3 className="text-sm font-medium text-white mb-2">Explore</h3>
          <div className="space-y-1 -ml-3">
            {['Trending', 'Shopping', 'Music', 'Movies', 'Live', 'Gaming', 'News', 'Sport', 'Learning', 'Fashion & beauty', 'Podcasts'].map((item) => (
              <Link
                key={item}
                to={`/explore/${item.toLowerCase()}`}
                className="flex items-center gap-6 px-3 py-2 hover:bg-[#272727] rounded-lg mx-3 transition-colors text-white"
              >
                <div className="w-6 h-6 bg-transparent" />
                <span className="text-sm">{item}</span>
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};
