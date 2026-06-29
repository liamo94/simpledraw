import { useEffect, useRef, type ReactNode } from "react";

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 aspect-video"
      style={{
        background: "rgba(57,255,20,0.02)",
        border: "2px dashed rgba(57,255,20,0.12)",
      }}
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(57,255,20,0.25)"
        strokeWidth="1.5"
      >
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
      <p
        className="text-xs italic text-center max-w-xs px-4"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        {label}
      </p>
    </div>
  );
}

function VideoPlayer({ src }: { src: string }) {
  return (
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      className="w-full"
      style={{ background: "#000", display: "block" }}
    />
  );
}

function useScrollFade(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

interface FeatureSectionProps {
  flip?: boolean;
  videoLabel: string;
  videoSrc?: string;
  imgSrc?: string;
  headline: string;
  body: ReactNode;
  tag?: string;
  pills?: string[];
}

export function FeatureSection({
  flip = false,
  videoLabel,
  videoSrc,
  imgSrc,
  headline,
  body,
  tag,
  pills,
}: FeatureSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFade(ref);

  const titleBlock = (
    <div className="flex flex-col gap-3">
      {tag && (
        <span
          style={{
            fontFamily: "'Bangers', cursive",
            fontSize: "0.9rem",
            letterSpacing: "0.1em",
            color: "#39ff14",
          }}
        >
          {tag.toUpperCase()}
        </span>
      )}
      <h2
        className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight"
        style={{ letterSpacing: "-0.02em" }}
      >
        {headline}
      </h2>
    </div>
  );

  const bodyBlock = (
    <div className="flex flex-col gap-5">
      <div
        className="text-base leading-relaxed"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {body}
      </div>
      {pills && pills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pills.map((pill) => (
            <span
              key={pill}
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                padding: "5px 13px",
                borderRadius: "999px",
                background: "rgba(57,255,20,0.07)",
                border: "1px solid rgba(57,255,20,0.18)",
                color: "rgba(57,255,20,0.8)",
                letterSpacing: "0.04em",
              }}
            >
              {pill}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const textBlock = (
    <div className="flex flex-col justify-center gap-6">
      {titleBlock}
      {bodyBlock}
    </div>
  );

  const rawMedia = imgSrc ? (
    <img src={imgSrc} alt={videoLabel} className="w-full" />
  ) : videoSrc ? (
    <VideoPlayer src={videoSrc} />
  ) : (
    <VideoPlaceholder label={videoLabel} />
  );

  const videoBlock = (
    <div style={{ position: "relative" }}>
      {/* Glow bloom behind media */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-50px -70px",
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(57,255,20,0.18) 0%, transparent 65%)",
          filter: "blur(55px)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Media */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.09), 0 40px 90px rgba(0,0,0,0.7)",
        }}
      >
        {rawMedia}
      </div>
    </div>
  );

  return (
    <section className="py-20 sm:py-28 px-6 relative">
      {/* Ambient section glow on the media side */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          [flip ? "right" : "left"]: "-60px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(57,255,20,0.09) 0%, transparent 65%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        ref={ref}
        className="scroll-fade mx-auto"
        style={{ maxWidth: "min(1360px, 94vw)" }}
      >
        {/* Mobile: title → video → body */}
        <div className="lg:hidden flex flex-col gap-6">
          {titleBlock}
          {videoBlock}
          {bodyBlock}
        </div>
        {/* Desktop: asymmetric — media gets more space */}
        <div
          className="hidden lg:grid items-center"
          style={{
            gridTemplateColumns: flip ? "1fr 1.45fr" : "1.45fr 1fr",
            gap: "80px",
          }}
        >
          {flip ? (
            <>
              {textBlock}
              {videoBlock}
            </>
          ) : (
            <>
              {videoBlock}
              {textBlock}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
