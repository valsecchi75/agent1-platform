"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface LoginAudioProps {
  musicFiles: string[];
  onAudioData?: (data: Uint8Array<ArrayBufferLike> | null) => void;
}

export function LoginAudio({ musicFiles, onAudioData }: LoginAudioProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [barHeights, setBarHeights] = useState([3, 5, 4, 3]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const trackIndexRef = useRef(0);
  const shuffledRef = useRef<string[]>([]);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);
  // Stable ref for onAudioData to avoid re-creating callbacks
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  // Shuffle music files once when they arrive
  useEffect(() => {
    if (musicFiles.length > 0 && shuffledRef.current.length === 0) {
      shuffledRef.current = [...musicFiles].sort(() => Math.random() - 0.5);
    }
  }, [musicFiles]);

  const startAnalyserLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const updateData = () => {
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current);
        onAudioDataRef.current?.(dataArrayRef.current);
        const d = dataArrayRef.current;
        const low = d.slice(0, 3).reduce((a, b) => a + b, 0) / (3 * 255);
        const ml = d.slice(3, 8).reduce((a, b) => a + b, 0) / (5 * 255);
        const mh = d.slice(8, 16).reduce((a, b) => a + b, 0) / (8 * 255);
        const hi = d.slice(16, 28).reduce((a, b) => a + b, 0) / (12 * 255);
        setBarHeights([3 + low * 14, 3 + ml * 14, 3 + mh * 14, 3 + hi * 14]);
      }
      rafRef.current = requestAnimationFrame(updateData);
    };
    rafRef.current = requestAnimationFrame(updateData);
  }, []); // stable — uses ref for onAudioData

  const startMusic = useCallback(() => {
    if (startedRef.current) return;
    if (shuffledRef.current.length === 0) return;
    startedRef.current = true;

    // Pick a random starting track
    const startIndex = Math.floor(Math.random() * shuffledRef.current.length);
    trackIndexRef.current = startIndex;

    const audio = new Audio(`/login/music/${shuffledRef.current[startIndex]}`);
    audio.volume = 0.2;
    audioRef.current = audio;

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    contextRef.current = ctx;
    analyserRef.current = analyser;
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    audio.addEventListener("ended", () => {
      trackIndexRef.current = (trackIndexRef.current + 1) % shuffledRef.current.length;
      audio.src = `/login/music/${shuffledRef.current[trackIndexRef.current]}`;
      audio.play().catch(() => { /* browser may block autoplay */ });
    });

    audio.play().then(() => {
      setIsPlaying(true);
      startAnalyserLoop();
    }).catch(() => {
      // Autoplay blocked — reset guard so interaction handler can retry
      startedRef.current = false;
      audioRef.current = null;
      ctx.close().catch(() => { /* browser may block close */ });
      contextRef.current = null;
      analyserRef.current = null;
    });

    _initHoverSound();
  }, [startAnalyserLoop]);

  // Button click handler — always works regardless of state
  const handleClick = useCallback(() => {
    if (!startedRef.current) {
      // Not started yet — start music
      startMusic();
      return;
    }
    // Already started — toggle play/pause
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onAudioDataRef.current?.(null);
      cancelAnimationFrame(rafRef.current);
      setBarHeights([3, 5, 4, 3]);
    } else {
      // Resume — also resume AudioContext if suspended (browser policy)
      if (contextRef.current?.state === "suspended") {
        contextRef.current.resume();
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        startAnalyserLoop();
      }).catch(() => { /* browser may block autoplay */ });
    }
  }, [isPlaying, startMusic, startAnalyserLoop]);

  // ── Auto-start: try autoplay, then listen for ANY user interaction ──
  useEffect(() => {
    if (shuffledRef.current.length === 0) return;

    // Try autoplay after short delay
    const timer = setTimeout(() => {
      if (!startedRef.current) startMusic();
    }, 500);

    // Fallback: any user interaction (persistent listeners until music starts)
    const events = ["click", "mousedown", "touchstart", "keydown"] as const;
    const handler = () => {
      if (!startedRef.current) {
        startMusic();
      }
      // If music started, remove all listeners
      if (startedRef.current) {
        events.forEach((evt) => document.removeEventListener(evt, handler));
      }
    };
    events.forEach((evt) =>
      document.addEventListener(evt, handler, { passive: true })
    );

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => document.removeEventListener(evt, handler));
    };
  }, [musicFiles, startMusic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      contextRef.current?.close();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 left-7 z-[999] flex items-end gap-[4px] cursor-pointer"
      style={{ height: 24, padding: "8px", margin: "-8px" }}
      title={isPlaying ? "Mute" : "Unmute"}
    >
      {barHeights.map((h, i) => (
        <div
          key={i}
          className="audio-bar"
          style={{
            height: isPlaying ? `${Math.max(h, 4)}px` : "5px",
            width: isPlaying ? "3px" : "5px",
            opacity: isPlaying ? 0.95 : 0.6,
            borderRadius: isPlaying ? "1.5px" : "50%",
          }}
        />
      ))}
    </button>
  );
}

// ── Hover sound ──
let _hoverAudio: HTMLAudioElement | null = null;
let _hoverReady = false;

function _initHoverSound() {
  if (_hoverReady) return;
  _hoverAudio = new Audio("/login/sounds/ui-hover.mp3");
  _hoverAudio.volume = 0.08;
  _hoverAudio.preload = "auto";
  _hoverReady = true;
}

export function playHoverSound() {
  if (!_hoverReady || !_hoverAudio) return;
  _hoverAudio.currentTime = 0;
  _hoverAudio.play().catch(() => { /* browser may block autoplay */ });
}
