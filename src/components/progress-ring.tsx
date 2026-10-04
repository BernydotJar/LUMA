export function ProgressRing({
  value,
  size = 76,
  stroke = 8,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const dash = circumference - (clamped / 100) * circumference;

  return (
    <span style={{ width: size, height: size, position: "relative", display: "inline-grid", placeItems: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dash}
        />
      </svg>
      <span style={{ position: "absolute", display: "grid", textAlign: "center", lineHeight: 1 }}>
        <strong style={{ fontSize: size > 70 ? ".95rem" : ".72rem", letterSpacing: "-.04em" }}>{value}%</strong>
        {label && <small style={{ marginTop: 4, color: "var(--muted)", fontSize: ".5rem" }}>{label}</small>}
      </span>
    </span>
  );
}
