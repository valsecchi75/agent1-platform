"use client";

import { useState } from "react";
import { playHoverSound } from "./LoginAudio";

const hover = "cursor-default hover:opacity-100 transition-opacity duration-150";
const onHover = () => playHoverSound();

export function LoginUI() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      {/* ── Top left — Brand claim (Arimo) ── */}
      <div className="fixed top-6 left-8 z-50 select-none" style={{ fontFamily: "'Arimo', sans-serif" }}>
        <p className="text-white tracking-[0.04em] leading-snug login-flicker font-normal" style={{ fontSize: "1.45em", "--flicker-delay": "0s" } as React.CSSProperties}>
          <span className={hover} onMouseEnter={onHover}>agent 1</span>{" "}
          <span className="opacity-30 font-light" onMouseEnter={onHover}>—</span>{" "}
          <span className={`opacity-60 font-light ${hover}`} onMouseEnter={onHover}>from vision to form</span>
        </p>
        <p className="text-white/40 tracking-[0.06em] login-flicker font-light" style={{ fontSize: "0.78em", "--flicker-delay": "0.5s" } as React.CSSProperties}>
          <span className={`opacity-80 ${hover}`} onMouseEnter={onHover}>connect</span>{" "}
          <span className="opacity-40">any api.</span>{" "}
          <span className={`opacity-80 ${hover}`} onMouseEnter={onHover}>build</span>{" "}
          <span className="opacity-40">any workflow.</span>{" "}
          <span className={`opacity-80 ${hover}`} onMouseEnter={onHover}>generate</span>{" "}
          <span className="opacity-40">anything.</span>
        </p>
      </div>

      {/* ── Top right — Contact ── */}
      <div className="fixed top-6 right-8 z-50 flex items-center gap-4">
        <button
          onClick={() => setContactOpen(true)}
          onMouseEnter={onHover}
          className="text-white/60 hover:text-white text-[0.7em] tracking-[0.18em] transition-colors cursor-pointer"
          style={{ fontFamily: "'Arimo', sans-serif" }}
        >
          Click to contact
        </button>
      </div>

      {/* ── Bottom right — Footer ── */}
      <div className="fixed bottom-6 right-8 z-50 select-none text-right">
        <p className="text-white/25 uppercase tracking-[0.12em] font-mono" style={{ fontSize: "0.5em" }}>
          <span className={hover} onMouseEnter={onHover}>///</span>{" "}
          <span className={hover} onMouseEnter={onHover}>2026</span>{" "}
          <span className={hover} onMouseEnter={onHover}>©</span>{" "}
          <a href="https://linkedin.com/in/valsecchisergio/" target="_blank" rel="noopener noreferrer" className={hover} onMouseEnter={onHover}>
            Sergio Valsecchi
          </a>{" "}
          <span className="opacity-50">— Fork of Node Banana</span>
        </p>
        <p className="text-white/15 uppercase tracking-[0.12em] font-mono mt-0.5" style={{ fontSize: "0.45em" }}>
          <span className={hover} onMouseEnter={onHover}>Powered by</span>{" "}
          <span className={hover} onMouseEnter={onHover}>Gemini</span>{" "}
          <span className="opacity-50">+</span>{" "}
          <span className={hover} onMouseEnter={onHover}>Nano Banana Pro</span>
        </p>
      </div>

      {/* ── Contact popup ── */}
      {contactOpen && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center contact-entering" onClick={() => setContactOpen(false)}>
          <div className="flex flex-col items-center gap-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setContactOpen(false)}
              onMouseEnter={onHover}
              className="fixed top-6 right-8 text-white/50 hover:text-white text-[0.65em] uppercase tracking-[0.25em] transition-colors duration-200 cursor-pointer"
            >
              Close
            </button>

            <ul className="text-white text-center space-y-4" style={{ fontSize: "1.2em", fontFamily: "'Arimo', sans-serif" }}>
              <li>
                <a href="mailto:sergio@kframeinteractive.com" target="_blank" rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-60 transition-all duration-200 py-2 inline-block uppercase tracking-[0.2em] hover:tracking-[0.25em]">
                  Email
                </a>
              </li>
              <li>
                <a href="https://linkedin.com/in/valsecchisergio/" target="_blank" rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-60 transition-all duration-200 py-2 inline-block uppercase tracking-[0.2em] hover:tracking-[0.25em]">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://instagram.com/wall__ai/" target="_blank" rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-60 transition-all duration-200 py-2 inline-block uppercase tracking-[0.2em] hover:tracking-[0.25em]">
                  Instagram
                </a>
              </li>
            </ul>

            <p className="text-white/15 text-[0.5em] uppercase tracking-[0.2em] font-mono mt-6">
              sergio@kframeinteractive.com
            </p>
          </div>
        </div>
      )}
    </>
  );
}
