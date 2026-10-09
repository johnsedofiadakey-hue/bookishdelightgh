"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Progressive enhancement: content remains visible when motion or JavaScript is unavailable. */
export function MotionController() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".storefront");
    if (!root) return;
    const elements = [...root.querySelectorAll<HTMLElement>("[data-reveal]")];
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      root.classList.remove("motion-active");
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    // Mark what is already on screen before enabling the hidden reveal state.
    // This avoids a visible flash as the page hydrates.
    elements.forEach((element) => {
      if (element.getBoundingClientRect().top < window.innerHeight + 60) element.classList.add("is-visible");
    });
    root.classList.add("motion-active");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -24px 0px" });
    elements.filter((element) => !element.classList.contains("is-visible")).forEach((element) => observer.observe(element));
    const disableMotion = () => {
      if (!motionPreference.matches) return;
      root.classList.remove("motion-active");
      elements.forEach((element) => element.classList.add("is-visible"));
      observer.disconnect();
    };
    motionPreference.addEventListener("change", disableMotion);

    return () => {
      observer.disconnect();
      motionPreference.removeEventListener("change", disableMotion);
    };
  }, [pathname]);

  return null;
}
