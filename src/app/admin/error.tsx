"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  const unavailable = /not connected|unavailable|disabled in production/i.test(error.message);

  return (
    <div className="adm-empty" role="alert">
      <div className="adm-empty-art" aria-hidden="true">!</div>
      <h2>{unavailable ? "Admin data is unavailable" : "This page could not load"}</h2>
      <p>
        {unavailable
          ? error.message
          : "Nothing was changed. Try again; if it keeps happening, note the time and tell the owner."}
        {error.digest ? <><br /><span className="adm-mono adm-small">Reference: {error.digest}</span></> : null}
      </p>
      <div className="adm-form-foot" style={{ justifyContent: "center" }}>
        <button className="adm-btn" data-variant="primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="adm-btn" href="/admin">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
