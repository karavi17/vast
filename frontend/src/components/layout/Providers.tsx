'use client';

import { LanguageProvider } from "@/context/LanguageContext";
import { UIProvider } from "@/context/UIContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <UIProvider>
        {children}
      </UIProvider>
    </LanguageProvider>
  );
}
