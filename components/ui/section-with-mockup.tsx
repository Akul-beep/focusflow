"use client";

import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionWithMockupProps = {
  title: ReactNode;
  description: ReactNode;
  /** Front / main mock (e.g. dashboard) */
  primaryContent: ReactNode;
  /** Back / depth layer (e.g. second screen), optional */
  secondaryContent?: ReactNode;
  reverseLayout?: boolean;
  className?: string;
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.18 },
  },
};

const itemVariants = {
  hidden: { opacity: 1, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * 21st.dev “Section with mockup” pattern — text + layered UI frames.
 * Pass real React mocks as `primaryContent` / `secondaryContent`.
 */
export function SectionWithMockup({
  title,
  description,
  primaryContent,
  secondaryContent,
  reverseLayout = false,
  className,
}: SectionWithMockupProps) {
  const layoutClasses = reverseLayout ? "md:grid-cols-2 md:grid-flow-dense" : "md:grid-cols-2";
  const textOrderClass = reverseLayout ? "md:col-start-2" : "";
  const imageOrderClass = reverseLayout ? "md:col-start-1 md:row-start-1" : "";

  return (
    <section
      className={cn(
        "relative overflow-hidden border-t border-[#e8e6dc] bg-white py-20 md:py-28",
        className
      )}
    >
      <div className="relative z-10 mx-auto w-full max-w-[1220px] px-4 md:px-10">
        <motion.div
          className={cn("grid w-full grid-cols-1 items-center gap-12 md:gap-10", layoutClasses)}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05, margin: "0px 0px -12% 0px" }}
        >
          <motion.div
            className={cn(
              "mx-auto flex max-w-[540px] flex-col gap-4 md:mx-0",
              textOrderClass
            )}
            variants={itemVariants}
          >
            <div className="space-y-2">
              <h2 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold leading-tight tracking-tight text-[#141413] md:text-[2.25rem] md:leading-snug">
                {title}
              </h2>
            </div>
            <div className="font-[family-name:var(--font-lora)] text-sm leading-relaxed text-[#6f6d66] md:text-[15px] md:leading-7">
              {description}
            </div>
          </motion.div>

          <motion.div
            className={cn(
              "relative mx-auto w-full min-w-0 max-w-[min(100%,480px)] md:max-w-[520px]",
              imageOrderClass
            )}
            variants={itemVariants}
          >
            {secondaryContent ? (
              <motion.div
                className="absolute z-0 overflow-hidden rounded-[28px] border border-[#e8e6dc]/80 bg-[#faf9f5] shadow-lg md:rounded-[32px]"
                style={{
                  width: "88%",
                  height: "78%",
                  top: reverseLayout ? "auto" : "8%",
                  bottom: reverseLayout ? "10%" : "auto",
                  left: reverseLayout ? "auto" : "-6%",
                  right: reverseLayout ? "-6%" : "auto",
                  filter: "blur(0.5px)",
                }}
                initial={{ opacity: 0.85, y: 12 }}
                whileInView={{ opacity: 1, y: reverseLayout ? 16 : -12 }}
                transition={{ duration: 1, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.45 }}
              >
                <div className="h-full w-full overflow-hidden">{secondaryContent}</div>
              </motion.div>
            ) : null}

            <motion.div
              className="relative z-10 overflow-hidden rounded-[28px] border border-[#e8e6dc] bg-[#faf9f5]/95 shadow-[0_32px_90px_rgba(20,20,19,0.12)] backdrop-blur-md md:rounded-[32px]"
              initial={{ y: 8, opacity: 0.96 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.08 }}
              viewport={{ once: true, amount: 0.45 }}
            >
              <div className="h-full w-full overflow-hidden">{primaryContent}</div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 z-0 h-px w-full"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(20,20,19,0.12) 0%, rgba(20,20,19,0) 100%)",
        }}
        aria-hidden
      />
    </section>
  );
}

type ScaledMockFrameProps = {
  naturalWidth: number;
  naturalHeight: number;
  /** Upper bound for scaled width (container may be narrower on mobile) */
  maxWidth: number;
  children: ReactNode;
  className?: string;
};

/** Scale fixed-size screen mocks to the container width (ResizeObserver). */
export function ScaledMockFrame({
  naturalWidth,
  naturalHeight,
  maxWidth,
  children,
  className,
}: ScaledMockFrameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(maxWidth);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const raw = el.getBoundingClientRect().width;
      const next = Math.min(maxWidth, Math.max(260, raw > 0 ? raw : maxWidth));
      setCw(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth]);

  const scale = cw / naturalWidth;
  const outH = naturalHeight * scale;

  return (
    <div ref={wrapRef} className={cn("mx-auto w-full max-w-full overflow-hidden", className)} style={{ maxWidth }}>
      <div className="overflow-hidden" style={{ width: cw, height: outH }}>
        <div
          style={{
            width: naturalWidth,
            height: naturalHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
