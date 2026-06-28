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
      className="w-full rounded-2xl"
      style={{ background: "#000" }}
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
}

export function FeatureSection({
  flip = false,
  videoLabel,
  videoSrc,
  imgSrc,
  headline,
  body,
  tag,
}: FeatureSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollFade(ref);

  const titleBlock = (
    <div className="flex flex-col gap-2">
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
        className="text-3xl sm:text-4xl font-bold leading-tight"
        style={{ letterSpacing: "-0.01em" }}
      >
        {headline}
      </h2>
    </div>
  );

  const bodyBlock = (
    <div
      className="text-base leading-relaxed"
      style={{ color: "rgba(255,255,255,0.55)" }}
    >
      {body}
    </div>
  );

  const textBlock = (
    <div className="flex flex-col justify-center gap-4">
      {titleBlock}
      {bodyBlock}
    </div>
  );

  const videoBlock = imgSrc ? (
    <img src={imgSrc} alt={videoLabel} className="w-full rounded-2xl" />
  ) : videoSrc ? (
    <VideoPlayer src={videoSrc} />
  ) : (
    <VideoPlaceholder label={videoLabel} />
  );

  return (
    <section className="py-16 sm:py-24 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        {/* Mobile: title → video → body */}
        <div className="lg:hidden flex flex-col gap-5">
          {titleBlock}
          {videoBlock}
          {bodyBlock}
        </div>
        {/* Desktop: side by side */}
        <div className="hidden lg:grid grid-cols-2 gap-20 items-center">
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
