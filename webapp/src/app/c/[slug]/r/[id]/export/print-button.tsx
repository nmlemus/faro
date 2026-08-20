"use client";
export default function PrintButton({ label }: { label: string }) {
  return (
    <button onClick={() => window.print()}
      className="no-print"
      style={{ position: "fixed", right: "1.5rem", bottom: "1.5rem",
               background: "#16181A", color: "#fff", border: "none",
               borderRadius: "999px", padding: ".7rem 1.4rem", fontWeight: 600,
               cursor: "pointer", boxShadow: "0 8px 24px rgb(0 0 0 / .25)" }}>
      {label}
    </button>
  );
}
