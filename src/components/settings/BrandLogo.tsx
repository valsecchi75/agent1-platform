"use client";

import { useState, useEffect } from 'react';

/**
 * AGENT 1 Brand Logo Component
 *
 * Three variants:
 * - 'brand'    → shows the color swatch (Aurora, Ember, Matrix, etc.)
 *                Used in the header next to "AGENT 1"
 * - 'icon'     → shows the A1 icon mark
 *                Used in login, welcome, project settings
 * - 'wordmark' → shows the "agent 1" wordmark
 *                Used in credits and about pages
 *
 * All logos adapt to dark/light theme automatically.
 */

interface LogoSet {
  dark: string;
  light: string;
}

// Color swatches — shown in header, changes with skin
const BRAND_LOGOS: Record<string, LogoSet> = {
  'ignite':   { dark: '/skins/ignite.svg',       light: '/skins/ignite.svg' },
  'aurora':   { dark: '/skins/aurora-dark.svg',  light: '/skins/aurora-light.svg' },
  'ember':    { dark: '/skins/ember.svg',        light: '/skins/ember.svg' },
  'matrix':   { dark: '/skins/matrix.svg',       light: '/skins/matrix.svg' },
  'sienna':   { dark: '/skins/sienna.svg',       light: '/skins/sienna.svg' },
  'sage':     { dark: '/skins/sage.svg',         light: '/skins/sage.svg' },
  'orchid':   { dark: '/skins/orchid.svg',       light: '/skins/orchid.svg' },
  'platinum': { dark: '/skins/platinum.svg',      light: '/skins/platinum.svg' },
  'abyss':    { dark: '/skins/abyss.svg',        light: '/skins/abyss.svg' },
  'amber':    { dark: '/skins/amber.svg',        light: '/skins/amber.svg' },
  'ocean':    { dark: '/skins/ocean.svg',        light: '/skins/ocean.svg' },
  'flux':     { dark: '/skins/flux.svg',         light: '/skins/flux.svg' },
  'neon':     { dark: '/skins/neon.svg',         light: '/skins/neon.svg' },
  'svelte':   { dark: '/skins/svelte.svg',       light: '/skins/svelte.svg' },
  'cobalt':   { dark: '/skins/cobalt.svg',       light: '/skins/cobalt.svg' },
  'coral':    { dark: '/skins/coral.svg',        light: '/skins/coral.svg' },
  'moss':     { dark: '/skins/moss.svg',         light: '/skins/moss.svg' },
  'zinc':     { dark: '/skins/zinc.svg',         light: '/skins/zinc.svg' },
  'indigo':   { dark: '/skins/indigo.svg',       light: '/skins/indigo.svg' },
  'rose':     { dark: '/skins/rose.svg',         light: '/skins/rose.svg' },
  'carbon':   { dark: '/skins/carbon.svg',       light: '/skins/carbon.svg' },
};

// A1 icon mark — always the same regardless of skin
const ICON_LOGO: LogoSet = {
  dark: '/brands/A1-logo-neg.png',
  light: '/brands/A1-logo.png',
};

// "agent 1" wordmark — always the same regardless of skin
const WORDMARK_LOGO: LogoSet = {
  dark: '/brands/agent-1-logo_neg.png',
  light: '/brands/agent-1-logo.png',
};

interface BrandLogoProps {
  className?: string;
  height?: string;
  variant?: 'brand' | 'icon' | 'wordmark';
}

export function BrandLogo({ className = '', height = 'h-4', variant = 'brand' }: BrandLogoProps) {
  const [skin, setSkin] = useState('aurora');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedSkin = localStorage.getItem('agent1-skin') || 'aurora';
    const savedTheme = (localStorage.getItem('agent1-theme') || 'dark') as 'dark' | 'light';
    setSkin(savedSkin);
    setTheme(savedTheme);

    const observer = new MutationObserver(() => {
      const currentSkin = document.documentElement.getAttribute('data-skin') || 'aurora';
      const currentTheme = (document.documentElement.getAttribute('data-theme') || 'dark') as 'dark' | 'light';
      setSkin(currentSkin);
      setTheme(currentTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-skin', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  // Select logo set based on variant
  let logos: LogoSet;
  if (variant === 'icon') {
    logos = ICON_LOGO;
  } else if (variant === 'wordmark') {
    logos = WORDMARK_LOGO;
  } else {
    logos = BRAND_LOGOS[skin] || BRAND_LOGOS['aurora'];
  }

  const logoSrc = theme === 'dark' ? logos.dark : logos.light;

  return (
    <img
      src={logoSrc}
      alt=""
      className={`${height} ${className}`}
      style={{ objectFit: 'contain' }}
    />
  );
}
