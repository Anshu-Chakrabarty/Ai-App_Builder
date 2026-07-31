"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TemplateManifest } from "@/lib/template-ai";

export type StudioTarget = {
  id: string;
  kind: "field" | "section" | "image";
  label: string;
  preview?: string;
};

type ChatTurn = { role: "user" | "assistant"; text: string };

type Props = {
  prompt: string;
  onPromptChange: (v: string) => void;
  busy: boolean;
  disabled?: boolean;
  pageKey: string;
  pageLabel: string;
  manifest?: TemplateManifest | null;
  target: StudioTarget | null;
  onTargetChange: (t: StudioTarget | null) => void;
  images: string[];
  onImagesChange: (urls: string[]) => void;
  onSend: () => void;
  /** Full project chat — shown scrollably like ChatGPT */
  chat?: ChatTurn[];
  canUndo?: boolean;
  onUndo?: () => void;
  onClearChat?: () => void;
};

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

async function fileToDataUrl(file: File, maxEdge = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function StudioPromptPanel({
  prompt,
  onPromptChange,
  busy,
  disabled,
  pageKey,
  pageLabel,
  manifest,
  target,
  onTargetChange,
  images,
  onImagesChange,
  onSend,
  chat = [],
  canUndo,
  onUndo,
  onClearChat,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceHint, setVoiceHint] = useState("");
  const recRef = useRef<SpeechRec | null>(null);

  useEffect(() => {
    setVoiceSupported(!!getSpeechRecognition());
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length, busy]);

  const sectionTargets = useMemo(() => {
    const out: StudioTarget[] = [];
    const push = (t: StudioTarget) => {
      if (out.some((x) => x.id === t.id)) return;
      out.push(t);
    };

    // Sections first — AI must be able to target every block
    const sections = (manifest?.sections || []).filter(
      (s) => s.pageKey === pageKey || s.pageKey === "home"
    );
    for (const s of sections) {
      push({
        id: s.id,
        kind: "section",
        label: s.name,
        preview: `Section · ${s.component}`,
      });
    }

    // Core visual / media shortcuts
    push({ id: "home.hero", kind: "section", label: "Hero", preview: "Whole hero block" });
    push({ id: "home.split", kind: "section", label: "Split", preview: "Text + right photo" });
    push({ id: "home.gallery", kind: "section", label: "Gallery", preview: "Photo grid" });
    push({ id: "home.features", kind: "section", label: "Features", preview: "Icon cards" });
    push({ id: "home.cta", kind: "section", label: "CTA", preview: "Bottom call-to-action" });
    push({ id: "home.form", kind: "section", label: "Form", preview: "Lead / contact form" });
    // Prefer gallery card image targets near the top of the chip list
    const galleryFields = (manifest?.editableFields || []).filter((f) =>
      /^media\.gallery\.\d+$/.test(f.id)
    );
    for (const f of galleryFields) {
      push({
        id: f.id,
        kind: "image",
        label: f.label,
        preview: "Gallery card photo",
      });
    }

    push({ id: "media.hero", kind: "image", label: "Hero image", preview: "Background photo" });
    push({ id: "media.split", kind: "image", label: "Split image", preview: "Right-column photo" });

    const fields = (manifest?.editableFields || []).filter(
      (f) =>
        f.pageKey === pageKey ||
        f.pageKey === "home" ||
        f.id.startsWith("media.") ||
        f.id.startsWith("visual.") ||
        f.id.startsWith("hero.")
    );
    for (const f of fields) {
      push({
        id: f.id,
        kind: f.type === "image" ? "image" : "field",
        label: f.label,
        preview: `${f.sectionId} · ${f.type}`,
      });
    }
    return out;
  }, [manifest, pageKey]);

  function startVoice() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setVoiceHint("Voice not supported in this browser — try Chrome.");
      return;
    }
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev: any) => {
      let finalText = "";
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (finalText) {
        const next = (prompt ? prompt.trim() + " " : "") + finalText.trim();
        onPromptChange(next.trim());
        setVoiceHint("Captured voice → added to prompt");
      } else if (interim) {
        setVoiceHint(`Listening… ${interim}`);
      }
    };
    rec.onerror = () => {
      setListening(false);
      setVoiceHint("Mic error — check browser permissions.");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    setVoiceHint("Listening… speak your edit");
  }

  function stopVoice() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!file.type.startsWith("image/")) continue;
      if (next.length >= 4) break;
      try {
        const url = await fileToDataUrl(file);
        next.push(url);
      } catch {
        setVoiceHint("Could not read that image.");
      }
    }
    onImagesChange(next);
    if (!prompt.trim()) {
      onPromptChange(
        target?.kind === "image" || target?.id.includes("media")
          ? "Replace this image with the uploaded photo."
          : "Use the uploaded image on the selected section (or hero if none selected)."
      );
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          void onPickFiles(dt.files);
        }
      }
    }
  }

  const canSend = !busy && !disabled && (!!prompt.trim() || images.length > 0);

  return (
    <div className="studio-prompt studio-chat-shell">
      <div className="studio-prompt-head">
        <div>
          <h3 style={{ margin: 0 }}>Studio chat</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
            Full memory on <strong>{pageLabel || pageKey}</strong>
            {target ? (
              <>
                {" "}
                · editing <strong>{target.label}</strong>
              </>
            ) : (
              " · click anything in the preview"
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onClearChat && chat.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={busy}
              onClick={onClearChat}
              title="Clear chat history (keeps the site)"
            >
              Clear chat
            </button>
          ) : null}
          {onUndo ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "6px 10px", fontSize: 12 }}
              disabled={!canUndo || busy}
              onClick={onUndo}
              title="Restore previous design"
            >
              ↶ Undo
            </button>
          ) : null}
        </div>
      </div>

      <div className="studio-chat-thread" ref={threadRef} aria-live="polite">
        {chat.length === 0 ? (
          <div className="studio-chat-empty">
            <strong>Start editing — the AI remembers this whole chat</strong>
            <p>
              Click a section, heading, or image in the preview, then describe the change. Follow-ups
              like “make it shorter” or “change that photo” continue from the last turn. Say
              something new (e.g. “now fix the About page”) to switch topics.
            </p>
            <ul>
              <li>Sections, images, titles, body text — all editable</li>
              <li>Chat scrolls and saves with this project</li>
              <li>Undo restores the previous design</li>
            </ul>
          </div>
        ) : (
          chat.map((m, i) => (
            <div
              key={`chat-${i}-${m.role}-${m.text.slice(0, 24)}`}
              className={`studio-chat-bubble ${m.role === "user" ? "is-user" : "is-ai"}`}
            >
              <div className="studio-chat-role">{m.role === "user" ? "You" : "AI"}</div>
              <div className="studio-chat-text">{m.text}</div>
            </div>
          ))
        )}
        {busy ? (
          <div className="studio-chat-bubble is-ai is-typing">
            <div className="studio-chat-role">AI</div>
            <div className="studio-chat-text">Thinking… applying your change</div>
          </div>
        ) : null}
      </div>

      <div className="studio-target-row">
        <span className="studio-target-label">Target</span>
        <div className="chip-row" style={{ flex: 1, maxHeight: 72, overflow: "auto" }}>
          <button
            type="button"
            className={`chip ${!target ? "on" : ""}`}
            disabled={disabled}
            onClick={() => onTargetChange(null)}
          >
            Whole page
          </button>
          {sectionTargets.slice(0, 40).map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip ${target?.id === t.id ? "on" : ""}`}
              disabled={disabled}
              title={t.preview}
              onClick={() => onTargetChange(t)}
            >
              {t.kind === "image" ? "🖼 " : t.kind === "section" ? "▣ " : "Aa "}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {target ? (
        <div className="studio-target-banner">
          <div>
            <strong>{target.label}</strong>
            <span className="muted">
              {" "}
              · {target.kind} · {target.id}
            </span>
            {target.preview ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                “{target.preview}”
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "6px 10px" }}
            onClick={() => onTargetChange(null)}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="studio-composer" onPaste={onPaste}>
        <textarea
          className="chat-input studio-composer-input"
          placeholder={
            target
              ? `Continue editing “${target.label}”… or ask a follow-up like “make it warmer”`
              : "Message the AI… follow-ups remember prior chat; new requests start fresh"
          }
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={disabled || busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && canSend) {
              e.preventDefault();
              onSend();
            }
          }}
        />

        {images.length > 0 ? (
          <div className="studio-attach-row">
            {images.map((src, i) => (
              <div key={i} className="studio-attach-thumb">
                <img src={src} alt={`Upload ${i + 1}`} />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="studio-composer-toolbar">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn btn-ghost studio-tool-btn"
            disabled={disabled || busy || images.length >= 4}
            onClick={() => fileRef.current?.click()}
            title="Upload image"
          >
            🖼 Image
          </button>
          <button
            type="button"
            className={`btn btn-ghost studio-tool-btn ${listening ? "is-listening" : ""}`}
            disabled={disabled || busy || !voiceSupported}
            onClick={() => (listening ? stopVoice() : startVoice())}
            title={voiceSupported ? "Voice prompt" : "Voice not supported"}
          >
            {listening ? "● Stop" : "🎤 Voice"}
          </button>
          <span className="muted" style={{ fontSize: 11, marginLeft: "auto" }}>
            Enter to send · Shift+Enter for newline
          </span>
        </div>
      </div>

      {voiceHint ? (
        <div className="muted" style={{ fontSize: 12 }}>
          {voiceHint}
        </div>
      ) : null}

      <div className="chip-row">
        {(target?.kind === "section"
          ? [
              "Make all text in this section clearer",
              "Align this section in a 3-column row",
              "Rewrite the heading",
            ]
          : target?.kind === "image"
            ? ["Replace this with the uploaded image", "Use a warmer photo here"]
            : target
              ? ["Make this shorter", "Rewrite in a warmer tone", "Change only this"]
              : [
                  "Make the headline shorter",
                  "Replace the hero image",
                  "What did we change last?",
                  "Now separately: fix the gallery title",
                ]
        ).map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            disabled={disabled || busy}
            onClick={() => onPromptChange(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={!canSend}
        onClick={onSend}
      >
        {busy ? "Thinking…" : images.length ? "Send with image" : "Send"}
      </button>
    </div>
  );
}
