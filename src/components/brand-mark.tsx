import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="LUMA inicio">
      <span className="brand-mark__icon" aria-hidden="true">
        <span className="brand-mark__letter">L</span>
        <span className="brand-mark__spark" />
      </span>
      {!compact && (
        <span className="brand-mark__copy">
          <strong>LUMA</strong>
          <small>learning intelligence</small>
        </span>
      )}
    </Link>
  );
}
