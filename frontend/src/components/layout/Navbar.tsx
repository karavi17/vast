'use client';

import { Search, Menu, Bell, Video, Mic, Globe, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useUI } from '@/context/UIContext';

export const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { toggleSidebar } = useUI();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchVisible(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-[#0f0f0f] flex items-center justify-between px-2 sm:px-4 z-50">
      {/* Mobile Search Overlay */}
      {isSearchVisible && (
        <div className="absolute inset-0 bg-[#0f0f0f] flex items-center px-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <button 
            onClick={() => setIsSearchVisible(false)}
            className="p-2 hover:bg-[#272727] rounded-full text-white mr-1"
          >
            <ArrowLeft size={24} />
          </button>
          <form onSubmit={handleSearch} className="flex items-center flex-1">
            <div className="flex items-center flex-1 bg-[#121212] border border-[#303030] rounded-full px-4 h-10 focus-within:border-blue-500">
              <input
                type="text"
                autoFocus
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-white outline-none w-full text-base"
              />
            </div>
            <button 
              type="submit"
              className="p-2 ml-2 bg-[#222222] rounded-full hover:bg-[#272727] text-white"
            >
              <Search size={20} />
            </button>
          </form>
          <button className="p-2 ml-1 bg-[#181818] hover:bg-[#272727] rounded-full text-white">
            <Mic size={20} />
          </button>
        </div>
      )}

      {/* Normal Navbar Content */}
      <div className={`flex items-center gap-1 sm:gap-4 ${isSearchVisible ? 'invisible' : ''}`}>
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-[#272727] rounded-full text-white"
        >
          <Menu size={24} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="VastWord Logo" className="h-6 sm:h-8 w-auto object-contain" />
          <span className="text-white font-bold text-xl tracking-tighter hidden xs:block">VastWord</span>
        </Link>
      </div>

      <div className={`hidden md:flex items-center gap-4 flex-1 max-w-[720px] ml-10 ${isSearchVisible ? 'invisible' : ''}`}>
        <form onSubmit={handleSearch} className="flex items-center flex-1">
          <div className="flex items-center flex-1 bg-[#121212] border border-[#303030] rounded-l-full px-4 h-10 focus-within:border-blue-500">
            <Search size={20} className="text-[#888888] mr-2" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-white outline-none w-full text-base"
            />
          </div>
          <button 
            type="submit"
            className="bg-[#222222] border border-l-0 border-[#303030] rounded-r-full px-5 h-10 hover:bg-[#272727] text-white"
          >
            <Search size={20} />
          </button>
        </form>
        <button className="p-2 bg-[#181818] hover:bg-[#272727] rounded-full text-white">
          <Mic size={20} />
        </button>
      </div>

      <div className={`flex items-center gap-0.5 sm:gap-2 ${isSearchVisible ? 'invisible' : ''}`}>
        {/* Mobile Search Toggle */}
        <button 
          onClick={() => setIsSearchVisible(true)}
          className="p-1.5 sm:p-2 hover:bg-[#272727] rounded-full text-white md:hidden"
        >
          <Search size={22} />
        </button>

        {/* Language Selector */}
        <div className="relative">
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 hover:bg-[#272727] rounded-lg text-white transition-colors"
          >
            <Globe size={20} />
            <span className="text-sm font-medium hidden md:block" suppressHydrationWarning>
              {language === 'RANDOM' ? 'Random' : language.charAt(0) + language.slice(1).toLowerCase()}
            </span>
          </button>
          
          {showLangMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-[#282828] border border-[#404040] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in duration-100">
              <div className="px-4 py-2 text-xs font-bold text-[#aaaaaa] uppercase tracking-wider">
                Audio Language
              </div>
              {(['RANDOM', 'HINDI', 'ENGLISH', 'TAMIL', 'TELUGU', 'KANNADA', 'MALAYALAM', 'BENGALI', 'PUNJABI', 'MARATHI'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setShowLangMenu(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#3f3f3f] transition-colors ${
                    language === lang ? 'text-blue-400 font-bold bg-[#383838]' : 'text-white'
                  }`}
                >
                  {lang === 'RANDOM' ? 'Random (Mixed)' : lang.charAt(0) + lang.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="p-2 hover:bg-[#272727] rounded-full text-white hidden xs:block">
          <Video size={24} />
        </button>
        <button className="p-2 hover:bg-[#272727] rounded-full text-white hidden xs:block">
          <Bell size={24} />
        </button>
        <button className="p-1 sm:p-2 hover:bg-[#272727] rounded-full text-white sm:ml-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-600 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium">
            P
          </div>
        </button>
      </div>
      
      {/* Click outside to close menu overlay */}
      {showLangMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowLangMenu(false)}
        />
      )}
    </nav>
  );
};
