"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#1c1a18", color: "#ece9e4", fontFamily: "system-ui, sans-serif", padding: 40 }}>
        <h1 style={{ fontSize: 20 }}>Cutroom hit an unexpected error.</h1>
        <button onClick={reset} style={{ marginTop: 16, padding: "6px 12px", border: "1px solid #444", borderRadius: 6, background: "transparent", color: "inherit" }}>
          Reload
        </button>
      </body>
    </html>
  );
}
