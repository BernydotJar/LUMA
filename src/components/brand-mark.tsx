"use client";

import Image from "next/image";
import Link from "next/link";
import { useLumaTheme } from "@/components/theme-provider";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { theme } = useLumaTheme();
  const seresTheme = theme === "se";

  return (
    <Link
      className="brand-mark"
      data-brand-theme={theme}
      href="/"
      aria-label={seresTheme ? "LUMA para Seres de Excelencia, inicio" : "LUMA inicio"}
    >
      <span className="brand-mark__icon" aria-hidden="true">
        <span className="brand-mark__letter">L</span>
        <span className="brand-mark__spark" />
      </span>
      {!compact && (
        <span className="brand-mark__copy">
          <strong>LUMA</strong>
          {seresTheme ? (
            <Image
              className="brand-mark__se-logo"
              src="/brand/seres-de-excelencia/logo.png"
              width={126}
              height={30}
              sizes="126px"
              alt="Seres de Excelencia"
              priority
            />
          ) : (
            <small>learning intelligence</small>
          )}
        </span>
      )}
    </Link>
  );
}
