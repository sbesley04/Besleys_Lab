import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";

// A photo rendered as a physical print taped into the notebook: white border,
// soft shadow, slight tilt, handwritten caption. Styling lives in globals.css
// (.snapshot and friends) so it stays consistent with the paper aesthetic.
//
// `src` accepts a static import (preferred — enables the blur placeholder) or
// a plain path/URL string for admin-managed photos (e.g. field notes).

type SnapshotProps = {
  src: StaticImageData | string;
  alt: string;
  caption?: string;
  /** Degrees of rotation, e.g. -2.5. Straightens on hover. */
  tilt?: number;
  /** CSS aspect-ratio for the crop, e.g. "4 / 3". Defaults to the photo's own
   *  (string srcs always crop — default "4 / 3"). */
  aspect?: string;
  /** Passed to next/image for responsive loading. */
  sizes?: string;
  priority?: boolean;
  taped?: boolean;
};

export default function Snapshot({
  src,
  alt,
  caption,
  tilt = 0,
  aspect,
  sizes,
  priority,
  taped = true,
}: SnapshotProps) {
  const style = { "--tilt": `${tilt}deg` } as CSSProperties;
  const isStatic = typeof src !== "string";
  // String srcs have unknown dimensions, so they always render in a cropped
  // aspect box (fill mode) and can't use the automatic blur placeholder.
  const cropAspect = aspect ?? (isStatic ? undefined : "4 / 3");

  return (
    <figure className={`snapshot${taped ? " snapshot--taped" : ""}`} style={style}>
      <div className="snapshot-frame" style={cropAspect ? { aspectRatio: cropAspect } : undefined}>
        {cropAspect ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            placeholder={isStatic ? "blur" : "empty"}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <Image
            src={src as StaticImageData}
            alt={alt}
            sizes={sizes}
            priority={priority}
            placeholder="blur"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        )}
      </div>
      {caption && <figcaption className="snapshot-caption">{caption}</figcaption>}
    </figure>
  );
}
