'use client'

import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
}

export default function PageLoader({ message = "Cargando..." }: PageLoaderProps) {
  return (
    <div className="
      flex flex-col items-center justify-center 
      h-64 w-full
      text-[var(--color-text)]
    ">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-4" />
      <p className="text-sm font-[var(--font-weight-medium)] uppercase tracking-wide opacity-70">
        {message}
      </p>
    </div>
  );
}