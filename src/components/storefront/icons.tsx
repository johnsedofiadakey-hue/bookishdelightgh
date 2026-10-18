import type React from "react";

export function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 5 5"/></svg>;
}

export function BagIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4.7 8h14.6l1.1 12H3.6L4.7 8Z"/><path d="M8.6 9V6.4a3.4 3.4 0 0 1 6.8 0V9"/></svg>;
}

export function WhatsAppIcon() {
  return <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 3.2A12.7 12.7 0 0 0 5.1 22.5L3.3 29l6.7-1.7A12.8 12.8 0 1 0 16 3.2Zm0 23.3a10.5 10.5 0 0 1-5.4-1.5l-.4-.2-4 1 1-3.9-.3-.4A10.6 10.6 0 1 1 16 26.5Zm5.8-7.9c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1c-1.9-.9-3.1-2.2-4-4-.2-.4 0-.5.2-.7l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.3 0-.7.1-.9.5-.3.4-1.2 1.2-1.2 2.8s1.2 3.2 1.4 3.4c.2.2 2.3 3.6 5.7 4.9 3.3 1.3 3.3.9 3.9.8.6-.1 1.8-.8 2-1.6s.2-1.5.1-1.6c-.1-.1-.3-.2-.6-.4Z"/></svg>;
}

// Small line icons. They take the size of the text around them (1em).
function LineIcon({ children }: { children: React.ReactNode }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

export function ArrowUpRightIcon() {
  return <LineIcon><path d="M7 17 17 7"/><path d="M8 7h9v9"/></LineIcon>;
}

export function ArrowLeftIcon() {
  return <LineIcon><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></LineIcon>;
}

export function ArrowDownIcon() {
  return <LineIcon><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></LineIcon>;
}

export function ArrowUpIcon() {
  return <LineIcon><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></LineIcon>;
}

export function HomeIcon() {
  return <LineIcon><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></LineIcon>;
}

export function GridIcon() {
  return <LineIcon><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></LineIcon>;
}

export function CheckIcon() {
  return <LineIcon><path d="m5 12.5 4.5 4.5L19 7.5"/></LineIcon>;
}

export function RefreshIcon() {
  return <LineIcon><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/></LineIcon>;
}

export function PlusIcon() {
  return <LineIcon><path d="M12 5v14"/><path d="M5 12h14"/></LineIcon>;
}

export function MinusIcon() {
  return <LineIcon><path d="M5 12h14"/></LineIcon>;
}
