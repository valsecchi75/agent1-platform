"use client";

import { useState } from "react";
import { playHoverSound } from "./LoginAudio";

const hover = "cursor-default hover:opacity-100 transition-opacity duration-150";
const onHover = () => playHoverSound();

export function LoginUI() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      {/* ── Top left — Big slogan (two lines, bold, skin-colored like agno.com) ── */}
      <div className="fixed top-8 left-10 z-50 select-none">
        <p
          className="leading-[1.1] login-flicker font-semibold tracking-[-0.02em]"
          style={{
            fontSize: "3.2em",
            color: "var(--login-accent)",
            "--flicker-delay": "0s",
          } as React.CSSProperties}
        >
          <span className={hover} onMouseEnter={onHover}>
            Connect. Build.
          </span>
          <br />
          <span className={`${hover} text-white`} onMouseEnter={onHover}>
            Generate<span style={{ color: "var(--login-accent)" }}>_</span>
          </span>
        </p>
      </div>

      {/* ── Top right — Brand name (Inter semibold, agno-style) ── */}
      <div className="fixed top-8 right-10 z-50 select-none text-right">
        <p
          className="text-white tracking-[-0.01em] leading-tight login-flicker font-semibold"
          style={{ fontSize: "2.4em", "--flicker-delay": "0s" } as React.CSSProperties}
        >
          <span className={hover} onMouseEnter={onHover}>
            agent
            <sup
              style={{
                fontSize: "0.5em",
                verticalAlign: "super",
                marginLeft: "3px",
                color: "var(--login-accent)",
                fontWeight: 700,
              }}
            >
              1
            </sup>
          </span>
          <span className="blinking-cursor" style={{ fontWeight: 300 }}>_</span>
        </p>
        <p
          className="text-white/30 tracking-[0.04em] login-flicker font-normal mt-1"
          style={{ fontSize: "0.85em", "--flicker-delay": "0.5s" } as React.CSSProperties}
        >
          <span className={`opacity-70 ${hover}`} onMouseEnter={onHover}>
            from vision to form
          </span>
        </p>
      </div>

      {/* ── Bottom right — Contact + Footer ── */}
      <div className="fixed bottom-8 right-10 z-50 select-none text-right">
        <button
          onClick={() => setContactOpen(true)}
          onMouseEnter={onHover}
          className="text-white/40 hover:text-white/80 text-[0.7em] tracking-[0.15em] uppercase transition-colors cursor-pointer font-light mb-2 block ml-auto"
        >
          Contact
        </button>
        <p className="text-white/20 uppercase tracking-[0.12em] font-mono" style={{ fontSize: "0.5em" }}>
          <span className={hover} onMouseEnter={onHover}>2026</span>{" "}
          <span className={hover} onMouseEnter={onHover}>&copy;</span>{" "}
          <a
            href="https://linkedin.com/in/valsecchisergio/"
            target="_blank"
            rel="noopener noreferrer"
            className={hover}
            onMouseEnter={onHover}
          >
            Sergio Valsecchi
          </a>
        </p>
      </div>

      {/* ── Contact popup ── */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center contact-entering"
          onClick={() => setContactOpen(false)}
        >
          <div className="flex flex-col items-center gap-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setContactOpen(false)}
              onMouseEnter={onHover}
              className="fixed top-8 right-10 text-white/40 hover:text-white text-[0.65em] uppercase tracking-[0.25em] transition-colors duration-200 cursor-pointer font-light"
            >
              Close
            </button>

            <ul className="text-white text-center space-y-5" style={{ fontSize: "1.1em" }}>
              <li>
                <a
                  href="mailto:sergio@kframeinteractive.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-50 transition-all duration-200 py-2 inline-block uppercase tracking-[0.25em] hover:tracking-[0.3em] font-light"
                >
                  Email
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com/in/valsecchisergio/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-50 transition-all duration-200 py-2 inline-block uppercase tracking-[0.25em] hover:tracking-[0.3em] font-light"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com/wall__ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={onHover}
                  className="hover:opacity-100 opacity-50 transition-all duration-200 py-2 inline-block uppercase tracking-[0.25em] hover:tracking-[0.3em] font-light"
                >
                  Instagram
                </a>
              </li>
            </ul>

            <p className="text-white/10 text-[0.5em] uppercase tracking-[0.2em] font-mono mt-6">
              sergio@kframeinteractive.com
            </p>
          </div>
        </div>
      )}
    </>
  );
}
