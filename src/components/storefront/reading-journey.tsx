"use client";

import Link from "next/link";
import { useState } from "react";

type JourneyShelf = { slug: string };

const chapters = [
  { slug: "baby-toddler", short: "Little ones", title: "First little discoveries", note: "Board books, bright pictures and stories made for small hands.", label: "Ages 0–3" },
  { slug: "early-readers", short: "First readers", title: "I can read it myself!", note: "Phonics, first words and the joy of turning a page alone.", label: "Ages 4–7" },
  { slug: "chapter-books", short: "Big adventures", title: "One more chapter…", note: "Longer stories for growing imaginations and curious readers.", label: "Ages 8–12" },
  { slug: "teens", short: "Young minds", title: "Stories to grow with", note: "Novels for pre-teens and teens finding their next favourite read.", label: "Ages 10+" },
] as const;

export function ReadingJourney({ shelves }: { shelves: JourneyShelf[] }) {
  const available = chapters.filter((chapter) => shelves.some((shelf) => shelf.slug === chapter.slug));
  const [active, setActive] = useState(0);
  const [turn, setTurn] = useState(0);
  const [condition, setCondition] = useState<"new" | "preloved">("new");
  if (available.length < 2) return null;

  const chapter = available[active] ?? available[0];
  const select = (index: number) => {
    if (index === active) return;
    setActive(index);
    setTurn((value) => value + 1);
  };

  return <section className="reading-journey shell" id="reading-journey" aria-labelledby="reading-journey-heading">
    <div className="reading-journey-intro">
      <p className="eyebrow">Find their next read</p>
      <h2 id="reading-journey-heading">Where will their reading journey go?</h2>
      <p>Choose their age or reading stage, then pick a shelf.</p>
      <div className="reading-journey-choices" role="group" aria-label="Choose a reading stage">
        {available.map((item, index) => <button key={item.slug} type="button" className={index === active ? "is-selected" : ""} aria-pressed={index === active} onClick={() => select(index)}><span aria-hidden="true">{item.label}</span>{item.short}</button>)}
      </div>
      <div className="reading-condition" role="group" aria-label="Choose book condition">
        <span className="reading-condition-label">I’m looking for</span>
        <div className="reading-condition-options">
          <button type="button" aria-pressed={condition === "new"} onClick={() => setCondition("new")}>Brand new</button>
          <button type="button" aria-pressed={condition === "preloved"} onClick={() => setCondition("preloved")}>Preloved</button>
        </div>
      </div>
    </div>
    <div className="reading-journey-stage" data-chapter={chapter.slug}>
      <div className="reading-journey-decoration" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="reading-journey-book" key={turn} aria-hidden="true">
        <div className="reading-page reading-page-left"><span>BOOKISH<br/>DELIGHT GH</span><i className="reading-doodle reading-doodle-one"/><i className="reading-doodle reading-doodle-two"/><i className="reading-doodle reading-doodle-three"/></div>
        <div className="reading-page reading-page-right"><span>{chapter.label}</span><strong>{chapter.short}</strong><i className="reading-page-line"/></div>
      </div>
      <div className="reading-journey-story" aria-live="polite" aria-atomic="true">
        <div className="reading-journey-story-inner" key={`story-${turn}`}>
          <span>Chapter {String(active + 1).padStart(2, "0")} / {String(available.length).padStart(2, "0")}</span>
          <h3>{chapter.title}</h3>
          <p>{chapter.note}</p>
          <Link href={`/shop?category=${chapter.slug}&condition=${condition}`}>Browse {condition === "new" ? "brand-new" : "preloved"} books <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <button className="reading-journey-next" type="button" onClick={() => select((active + 1) % available.length)} aria-label="Turn to the next reading stage"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    </div>
  </section>;
}
