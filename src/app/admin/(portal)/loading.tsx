export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="adm-skeleton" style={{ height: 34, width: "min(320px, 70%)", marginBottom: 18 }} />
      <div className="adm-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="adm-skeleton" key={index} style={{ height: 88 }} />
        ))}
      </div>
      <div className="adm-skeleton" style={{ height: 320 }} />
    </div>
  );
}
