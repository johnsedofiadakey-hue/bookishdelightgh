"use client";

import type { MouseEvent } from "react";
import { useState } from "react";

/** A small paper-book guide; the artwork underneath stays the hero's main image. */
export function HeroBookGuide() {
  const [turning, setTurning] = useState(false);

  function turnToFinder(event: MouseEvent<HTMLAnchorElement>) {
    const finder = document.getElementById("reading-journey");
    if (!finder) return;
    event.preventDefault();
    if (turning) return;
    setTurning(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      finder.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      window.history.replaceState(window.history.state, "", "#reading-journey");
      setTurning(false);
    }, reduceMotion ? 0 : 430);
  }

  return <a className={`hero-book-guide${turning ? " is-turning" : ""}`} href="#reading-journey" onClick={turnToFinder} aria-label="Turn the little book to find a reading stage">
    <svg viewBox="0 0 96 84" aria-hidden="true" focusable="false">
      <circle cx="48" cy="42" r="37" fill="#f6cc60"/>
      <circle cx="13" cy="21" r="5" fill="#e97a4e"/>
      <circle cx="84" cy="12" r="4" fill="#2874b7"/>
      <path d="M48 64c-9-7-20-8-31-5V27c11-3 22-2 31 5 9-7 20-8 31-5v32c-11-3-22-2-31 5Z" fill="#fffaf0" stroke="#1d3e67" strokeWidth="3" strokeLinejoin="round"/>
      <path d="M48 32v32" stroke="#1d3e67" strokeWidth="3"/>
      <path className="hero-guide-page" d="M48 62c8-9 16-12 25-12V30c-10 0-18 3-25 11Z" fill="#ffe6a4" stroke="#1d3e67" strokeWidth="2" strokeLinejoin="round"/>
      <circle cx="36" cy="44" r="2" fill="#1d3e67"/>
      <circle cx="61" cy="43" r="2" fill="#1d3e67"/>
      <path d="M38 50c5 5 14 5 19 0" fill="none" stroke="#1d3e67" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <span>Find my next book <b aria-hidden="true">↘</b></span>
  </a>;
}
