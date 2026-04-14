'use client';

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { useUI } from "@/context/UIContext";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useUI();

  return (
    <div className="flex flex-col min-h-screen w-full max-w-full overflow-x-hidden">
      <Navbar />
      <div className="flex pt-14 w-full max-w-full overflow-x-hidden">
        <Sidebar />
        <main className={`flex-1 transition-all duration-300 px-2 sm:px-4 md:px-8 pb-10 min-h-[calc(100vh-56px)] min-w-0 ${
          isSidebarOpen ? 'md:ml-60' : 'md:ml-0'
        }`}>
          {children}
        </main>
      </div>
    </div>
  );
}
