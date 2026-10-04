import type { SemanticObjectVariant } from "@/lib/experience-themes";
import styles from "./semantic-object.module.css";

export function SemanticObject({
  variant,
  size = "md",
  className,
}: {
  variant: SemanticObjectVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={[styles.object, className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      aria-hidden="true"
    >
      <span className={styles.core} />
      <span className={styles.layerOne} />
      <span className={styles.layerTwo} />
      <span className={styles.layerThree} />
    </span>
  );
}
