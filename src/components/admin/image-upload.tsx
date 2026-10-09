"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Uploads an image to /admin/api/upload, where the server validates the file
 * type by its bytes, compresses it to WebP, stores it and links it to the
 * record in one audited operation. Max 8 MB; JPEG, PNG or WebP.
 */
export function ImageUpload({ target, ownerId, label, defaultAlt = "", replaceNote }: { target: "cover" | "gallery" | "hero"; ownerId: string; label: string; defaultAlt?: string; replaceNote?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [key, setKey] = useState(newKey);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setStatus({ tone: "error", text: "Choose an image first." });
    if (file.size > 8 * 1024 * 1024) return setStatus({ tone: "error", text: "Images must be 8 MB or smaller." });
    if (!String(form.get("alt") ?? "").trim()) return setStatus({ tone: "error", text: "Describe the image in the alt text field." });
    form.set("target", target);
    form.set("ownerId", ownerId);
    form.set("idempotencyKey", key);
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch("/admin/api/upload", { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) return setStatus({ tone: "error", text: body.error ?? "Upload failed." });
      setStatus({ tone: "success", text: body.message ?? "Image saved." });
      setKey(newKey());
      setPreview(null);
      formRef.current?.reset();
      router.refresh();
    } catch {
      setStatus({ tone: "error", text: "Network problem during upload. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} className="adm-form" onSubmit={onSubmit}>
      <label className="adm-field">
        <span>{label}</span>
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
        <small>JPEG, PNG or WebP up to 8 MB. Converted to WebP and resized to 1600 px.{replaceNote ? ` ${replaceNote}` : ""}</small>
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Selected file preview" className="adm-cover" style={{ width: 120 }} />
      ) : null}
      <label className="adm-field">
        <span>Alt text <span className="req">*</span></span>
        <input type="text" name="alt" defaultValue={defaultAlt} maxLength={250} placeholder="e.g. Cover of The Mango Season showing a sunlit tree" />
      </label>
      <div className="adm-form-foot">
        <button className="adm-btn" data-variant="primary" type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload image"}
        </button>
      </div>
      <div aria-live="polite">{status ? <p className="adm-form-message" data-status={status.tone}>{status.text}</p> : null}</div>
    </form>
  );
}
