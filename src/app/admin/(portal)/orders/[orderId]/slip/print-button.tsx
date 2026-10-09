"use client";

export function PrintButton() {
  return (
    <button className="adm-btn" data-variant="primary" type="button" onClick={() => window.print()}>
      Print slip
    </button>
  );
}
