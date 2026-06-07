import { useMemo } from "react";

export function PageBranding() {
  const src = useMemo(() => {
    const base = import.meta.env.BASE_URL || "/";
    const prefix = base.endsWith("/") ? base : `${base}/`;
    return `${prefix}icone.png`;
  }, []);

  return (
    <div className="page-brand">
      <div className="page-brand__frame">
        <img
          className="page-brand__img"
          src={src}
          alt="Finanças"
          decoding="async"
          loading="eager"
        />
      </div>
    </div>
  );
}
