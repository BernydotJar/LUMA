"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./liquid-glass-preview.module.css";

type RefractionLayout = {
  cloneHeight: number;
  cloneLeft: number;
  cloneTop: number;
  cloneWidth: number;
  mapHeight: number;
  mapUrl: string;
  mapWidth: number;
  revision: number;
};

const MAP_PADDING = 18;
const REFRACTION_DEPTH = 30;
const REDUCED_TRANSPARENCY_QUERY = "(prefers-reduced-transparency: reduce)";

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function roundedRectDistance(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localX = Math.abs(x) - (halfWidth - radius);
  const localY = Math.abs(y) - (halfHeight - radius);
  const outsideX = Math.max(localX, 0);
  const outsideY = Math.max(localY, 0);

  return (
    Math.hypot(outsideX, outsideY) +
    Math.min(Math.max(localX, localY), 0) -
    radius
  );
}

function smoothStep(value: number) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function buildRoundedRectMap(
  mapWidth: number,
  mapHeight: number,
  lensWidth: number,
  lensHeight: number,
  radius: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(mapWidth, mapHeight);
  const pixels = image.data;
  const bevel = 4;
  const feather = 22;
  const curvature = 1.8;
  const boost = 0.78;

  const distanceAt = (pixelX: number, pixelY: number) =>
    roundedRectDistance(
      pixelX - mapWidth / 2,
      pixelY - mapHeight / 2,
      lensWidth,
      lensHeight,
      radius,
    );

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const sampleX = x + 0.5;
      const sampleY = y + 0.5;
      const distance = distanceAt(sampleX, sampleY);
      const gradientX = distanceAt(sampleX + 1, sampleY) - distanceAt(sampleX - 1, sampleY);
      const gradientY = distanceAt(sampleX, sampleY + 1) - distanceAt(sampleX, sampleY - 1);
      const gradientLength = Math.hypot(gradientX, gradientY) || 1;
      const normalX = gradientX / gradientLength;
      const normalY = gradientY / gradientLength;
      const span = distance < 0 ? bevel + feather : bevel;
      const edge = Math.max(0, 1 - Math.abs(distance) / span);
      const displacement = Math.pow(smoothStep(edge), curvature);
      const offset = (y * mapWidth + x) * 4;

      pixels[offset] = clampByte(127.5 - normalX * displacement * 127 * boost);
      pixels[offset + 1] = clampByte(127.5 - normalY * displacement * 127 * boost);
      pixels[offset + 2] = 128;
      pixels[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function SceneContent() {
  return (
    <>
      <span className={styles.sceneKicker}>Liquid Light</span>
      <span className={styles.sceneWord}>LUMA</span>
      <span className={`${styles.orb} ${styles.orbTeal}`} />
      <span className={`${styles.orb} ${styles.orbViolet}`} />
      <span className={`${styles.orb} ${styles.orbPeach}`} />
      <span className={styles.lightRibbon} />
      <span className={`${styles.trace} ${styles.traceTop}`} />
      <span className={`${styles.trace} ${styles.traceBottom}`} />
    </>
  );
}

export function LiquidGlassPreview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const revisionRef = useRef(0);
  const lastSignatureRef = useRef<string | null>(null);
  const reactId = useId();
  const filterIdBase = `luma-liquid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [layout, setLayout] = useState<RefractionLayout | null>(null);
  const filterId = `${filterIdBase}-${layout?.revision ?? 0}`;

  useEffect(() => {
    const root = rootRef.current;
    const lens = lensRef.current;
    if (!root || !lens) return;

    const transparencyQuery = window.matchMedia(REDUCED_TRANSPARENCY_QUERY);
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);

      if (transparencyQuery.matches) {
        lastSignatureRef.current = null;
        setLayout(null);
        return;
      }

      frame = requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const lensRect = lens.getBoundingClientRect();
        const lensWidth = Math.max(1, Math.round(lensRect.width));
        const lensHeight = Math.max(1, Math.round(lensRect.height));
        const lensLeft = Math.round(lensRect.left - rootRect.left);
        const lensTop = Math.round(lensRect.top - rootRect.top);
        const signature = [
          Math.round(rootRect.width),
          Math.round(rootRect.height),
          lensWidth,
          lensHeight,
          lensLeft,
          lensTop,
        ].join(":");

        if (signature === lastSignatureRef.current) return;

        const mapWidth = lensWidth + MAP_PADDING * 2;
        const mapHeight = lensHeight + MAP_PADDING * 2;
        const radius = Math.min(22, Math.round(lensHeight / 2.3));
        const mapUrl = buildRoundedRectMap(
          mapWidth,
          mapHeight,
          lensWidth,
          lensHeight,
          radius,
        );

        if (!mapUrl) {
          lastSignatureRef.current = null;
          setLayout(null);
          return;
        }

        revisionRef.current += 1;
        lastSignatureRef.current = signature;
        setLayout({
          cloneHeight: Math.round(rootRect.height),
          cloneLeft: -(lensLeft - MAP_PADDING),
          cloneTop: -(lensTop - MAP_PADDING),
          cloneWidth: Math.round(rootRect.width),
          mapHeight,
          mapUrl,
          mapWidth,
          revision: revisionRef.current,
        });
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(lens);
    transparencyQuery.addEventListener("change", measure);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      transparencyQuery.removeEventListener("change", measure);
    };
  }, []);

  return (
    <div
      className={styles.preview}
      data-liquid-glass="refractive"
      data-refraction-ready={layout ? "true" : "false"}
      ref={rootRef}
    >
      <div className={styles.scene} aria-hidden="true">
        <SceneContent />
      </div>

      <div className={styles.lens} ref={lensRef} aria-hidden="true">
        <div className={styles.lensClip}>
          {layout ? (
            <div
              className={styles.refraction}
              style={{
                filter: `url(#${filterId})`,
                height: layout.mapHeight,
                left: -MAP_PADDING,
                top: -MAP_PADDING,
                width: layout.mapWidth,
              }}
            >
              <div
                className={styles.sceneClone}
                style={{
                  height: layout.cloneHeight,
                  left: layout.cloneLeft,
                  top: layout.cloneTop,
                  width: layout.cloneWidth,
                }}
              >
                <SceneContent />
              </div>
            </div>
          ) : null}
          <span className={styles.lensTint} />
          <span className={styles.lensGlint} />
        </div>
      </div>

      <span className={`${styles.surfaceChip} ${styles.surfaceChipLeft}`} aria-hidden="true" />
      <span className={`${styles.surfaceChip} ${styles.surfaceChipRight}`} aria-hidden="true" />

      {layout ? (
        <svg className={styles.filterHousing} aria-hidden="true" focusable="false">
          <defs>
            <filter
              id={filterId}
              x="0"
              y="0"
              width={layout.mapWidth}
              height={layout.mapHeight}
              filterUnits="userSpaceOnUse"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={layout.mapUrl}
                x="0"
                y="0"
                width={layout.mapWidth}
                height={layout.mapHeight}
                preserveAspectRatio="none"
                result="luma-map"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="luma-map"
                scale={REFRACTION_DEPTH}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      ) : null}
    </div>
  );
}
