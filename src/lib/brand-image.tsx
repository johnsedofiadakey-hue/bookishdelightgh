import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

async function logoDataUrl() {
  const image = await readFile(join(process.cwd(), "public/brand/bookish-delight-logo-original.jpeg"));
  return `data:image/jpeg;base64,${image.toString("base64")}`;
}

export async function renderBrandIcon(dimension: number) {
  const logo = await logoDataUrl();
  const scale = dimension / 192;
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", overflow: "hidden", width: dimension, height: dimension, borderRadius: Math.round(32 * scale), background: "#fff" }}>
      {/* Crops the exact supplied mark without redrawing any part of the logo. */}
      <img src={logo} alt="" width={Math.round(500 * scale)} height={Math.round(500 * scale)} style={{ position: "absolute", width: 500 * scale, height: 500 * scale, left: -162 * scale, top: -68 * scale }}/>
    </div>,
    { width: dimension, height: dimension },
  );
}

export async function renderBrandShareCard() {
  const logo = await logoDataUrl();
  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: "flex", alignItems: "center", background: "#f8f6f0", color: "#203550", fontFamily: "Arial, sans-serif" }}>
      <div style={{ width: 690, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "65px 35px 65px 75px" }}>
        <div style={{ display: "flex", alignItems: "center", color: "#9a7017", fontSize: 22, fontWeight: 600 }}>Bookish Delight GH · Kumasi</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 68, lineHeight: 1.08, fontWeight: 600, letterSpacing: -2 }}>Children’s books & learning resources.</div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 25, lineHeight: 1.4, color: "#31506f" }}>Puzzles, educational games and more — ask us while we add our stock online.</div>
      </div>
      <div style={{ width: 510, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}><img src={logo} alt="" width="440" height="440" style={{ width: 440, height: 440 }}/></div>
    </div>,
    { width: 1200, height: 630 },
  );
}
