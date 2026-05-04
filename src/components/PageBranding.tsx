import { useCallback, useMemo, useState } from "react";

/** SVG em `public/RUMO.svg` primeiro para evitar 404 em cascata no GitHub Pages. */
const RUMO_EXTENSIONS = ["svg", "webp", "png", "jpg", "jpeg"] as const;

export function PageBranding() {
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState(false);
  const prefix = useMemo(() => {
    const base = import.meta.env.BASE_URL || "/";
    return base.endsWith("/") ? base : `${base}/`;
  }, []);
  const src = `${prefix}RUMO.${RUMO_EXTENSIONS[i]}`;

  const onError = useCallback(() => {
    setI((prev) => {
      if (prev < RUMO_EXTENSIONS.length - 1) return prev + 1;
      queueMicrotask(() => setFailed(true));
      return prev;
    });
  }, []);

  if (failed) return null;

  return (
    <div className="page-brand">
      <div className="page-brand__frame">
        <img
          className="page-brand__img"
          src={src}
          alt="RUMO"
          decoding="async"
          loading="eager"
          onError={onError}
        />
      </div>
    </div>
  );
}
