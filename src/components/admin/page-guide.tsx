"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { icons } from "@/components/admin/icons";
import { guideFor } from "@/lib/admin/guides";

const ALL_KEY = "bd-admin-guides-hidden";
const keyFor = (id: string) => `bd-admin-guide-closed:${id}`;

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function write(key: string, value: boolean) {
  try {
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable: the guide simply opens on every visit.
  }
}

/** "How this page works" panel, chosen by the current admin URL. */
export function PageGuide() {
  const pathname = usePathname();
  const guide = guideFor(pathname);
  const [open, setOpen] = useState(true);
  const [hiddenAll, setHiddenAll] = useState(false);

  useEffect(() => {
    if (!guide) return;
    setHiddenAll(read(ALL_KEY));
    setOpen(!read(keyFor(guide.id)));
  }, [guide]);

  if (!guide) return null;

  if (hiddenAll) {
    return <div className="adm-guide-off"><button type="button" className="adm-link" onClick={() => { write(ALL_KEY, false); setHiddenAll(false); setOpen(true); }}>{icons.help} Show page guides</button></div>;
  }

  return (
    <details
      className="adm-guide"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        write(keyFor(guide.id), !next);
      }}
    >
      <summary>
        {icons.help}
        <span>How this page works: <strong>{guide.title}</strong></span>
        <small>{open ? "Hide" : "Show"}</small>
      </summary>
      <div className="adm-guide-body">
        <p className="adm-guide-purpose">{guide.purpose}</p>
        <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        {guide.tips?.length ? <div className="adm-guide-tips"><strong>Good to know</strong><ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul></div> : null}
        <button type="button" className="adm-guide-hide-all" onClick={() => { write(ALL_KEY, true); setHiddenAll(true); }}>Hide guides on all pages</button>
      </div>
    </details>
  );
}
