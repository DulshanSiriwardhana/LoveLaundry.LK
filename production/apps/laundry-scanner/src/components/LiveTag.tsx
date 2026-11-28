import { useState } from "react";
import { API_BASE } from "../api";

type LiveTagProps = {
  linenId: string;
  compact?: boolean;
  className?: string;
};

export function LiveTag({ linenId, compact = false, className }: LiveTagProps) {
  const [failed, setFailed] = useState(false);
  const id = linenId.trim();
  if (!id) return null;

  const qrSrc = `${API_BASE}/i/${encodeURIComponent(id)}/qr.svg`;
  const liveHref = `${API_BASE}/i/${encodeURIComponent(id)}`;
  const size = compact ? 40 : 72;

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 8 : 10,
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      {!failed ? (
        <a
          href={liveHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open live tag for ${id}`}
          style={{
            display: "inline-flex",
            flex: "0 0 auto",
            minWidth: 40,
            minHeight: 40,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={qrSrc}
            alt={`QR code for linen ${id}`}
            width={size}
            height={size}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{
              width: size,
              height: size,
              display: "block",
              borderRadius: 4,
              background: "#fff",
            }}
          />
        </a>
      ) : null}
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: compact ? 12 : 13,
            lineHeight: 1.3,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {id}
        </span>
        {failed ? (
          <a
            href={liveHref}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              lineHeight: 1.3,
              minHeight: 40,
              display: "inline-flex",
              alignItems: "center",
              overflowWrap: "anywhere",
            }}
          >
            Open live tag
          </a>
        ) : null}
      </div>
    </div>
  );
}
