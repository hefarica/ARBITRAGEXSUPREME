'use client'

import { useState, useEffect } from 'react';
import { Moon, Sun, Smartphone, Palette } from 'lucide-react';

// Temas disponibles
const themes = ['light', 'dark', 'ios-glass', 'arbitragex'];

const themeIcons = {
  light: Sun,
  dark: Moon,
  'ios-glass': Smartphone,
  arbitragex: Palette
};

const themeNames = {
  light: 'Claro',
  dark: 'Oscuro',
  'ios-glass': 'iOS Glass',
  arbitragex: 'ArbitrageX'
};

export default function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Evitar hidration mismatch
  useEffect(() => {
    setMounted(true);
    // Leer tema del localStorage o usar default
    const savedTheme = localStorage.getItem('theme') || 'light';
    setCurrentTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (theme: string) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse"></div>
    );
  }

  const IconComponent = themeIcons[currentTheme as keyof typeof themeIcons];

  return (
    <button
      onClick={cycleTheme}
      className="
        flex items-center justify-center
        w-10 h-10 
        rounded-full 
        transition-all duration-200 
        hover:scale-105 
        focus:outline-none focus:ring-2 focus:ring-offset-2
        bg-[var(--color-card)] 
        border border-[var(--color-border)]
        text-[var(--color-text)]
        hover:bg-[var(--color-hover)]
        focus:ring-[var(--color-primary)]
        shadow-[var(--shadow)]
      "
      title={`Cambiar tema (actual: ${themeNames[currentTheme as keyof typeof themeNames]})`}
      aria-label={`Cambiar tema. Tema actual: ${themeNames[currentTheme as keyof typeof themeNames]}`}
    >
      <IconComponent 
        className={`
          w-5 h-5 transition-colors duration-200
          ${currentTheme === 'light' ? 'text-yellow-500' : ''}
          ${currentTheme === 'dark' ? 'text-yellow-400' : ''}
          ${currentTheme === 'ios-glass' ? 'text-blue-500' : ''}
          ${currentTheme === 'arbitragex' ? 'text-purple-500' : ''}
        `} 
      />
    </button>
  );
}