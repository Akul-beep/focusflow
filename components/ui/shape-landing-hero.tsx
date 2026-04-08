"use client";

/**
 * Kokonut UI-style **Shape Landing Hero** (geometric blobs + gradient headline).
 * Same pattern as 21st.dev / Kokonut UI shape hero; tuned for Flowly tokens.
 */
import { motion } from "framer-motion";
import { ChevronDown, Circle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-[#faf9f5]/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate,
      }}
      transition={{
        type: "spring",
        stiffness: 38,
        damping: 22,
        mass: 0.85,
        delay,
        opacity: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 18, 0],
          x: [0, 6, -4, 0],
        }}
        transition={{
          duration: 14,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-[#faf9f5]/[0.12]",
            "shadow-[0_8px_32px_0_rgba(217,119,87,0.12)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(250,249,245,0.18),transparent_70%)]"
          )}
        />
      </motion.div>
    </motion.div>
  );
}

function HeroGeometric({
  badge = "When your week moves, your plan catches up",
  title1 = "What do I do next?",
  title2 = "Today tells you.",
  description = "Adaptive AI for weeks that never sit still. Slip? Rebalance repacks your calendar. Add a task, get AI steps dropped into real time blocks. Paste your syllabus, spread exam prep, walk in feeling ready. Focus mode keeps timer, forest, and motivation in one place.",
  children,
}: {
  badge?: string;
  title1?: string;
  title2?: string;
  description?: string;
  /** CTA row: pass as `children` from a Server Component (serializable slot). Do not use a custom `actions` prop. */
  children?: ReactNode;
}) {
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 120,
        damping: 24,
        mass: 0.65,
        delay: 0.28 + i * 0.1,
      },
    }),
  };

  return (
    <div className="relative isolate flex min-h-[100svh] w-full flex-col overflow-x-hidden bg-[#141413]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#d97757]/[0.07] via-transparent to-[#6a9bcc]/[0.07] blur-3xl" />
        <div className="absolute inset-0 overflow-hidden">
          <ElegantShape
            delay={0.3}
            width={600}
            height={140}
            rotate={12}
            gradient="from-[#d97757]/[0.18]"
            className="left-[-10%] top-[15%] md:left-[-5%] md:top-[20%]"
          />
          <ElegantShape
            delay={0.5}
            width={500}
            height={120}
            rotate={-15}
            gradient="from-[#6a9bcc]/[0.16]"
            className="right-[-5%] top-[70%] md:right-[0%] md:top-[75%]"
          />
          <ElegantShape
            delay={0.4}
            width={300}
            height={80}
            rotate={-8}
            gradient="from-[#788c5d]/[0.15]"
            className="bottom-[5%] left-[5%] md:bottom-[10%] md:left-[10%]"
          />
          <ElegantShape
            delay={0.6}
            width={200}
            height={60}
            rotate={20}
            gradient="from-[#faf9f5]/[0.1]"
            className="right-[15%] top-[10%] md:right-[20%] md:top-[15%]"
          />
          <ElegantShape
            delay={0.7}
            width={150}
            height={40}
            rotate={-25}
            gradient="from-[#d97757]/[0.12]"
            className="left-[20%] top-[5%] md:left-[25%] md:top-[10%]"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141413] via-transparent to-[#141413]/80" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-4 py-6 md:px-6 md:py-8">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#faf9f5]/[0.1] bg-[#faf9f5]/[0.04] px-3 py-1 md:mb-8"
          >
            <Circle className="h-2 w-2 fill-[#d97757]/90" aria-hidden />
            <span className="text-sm font-medium tracking-wide text-[#faf9f5]/55">{badge}</span>
          </motion.div>

          <motion.div custom={1} variants={fadeUpVariants} initial="hidden" animate="visible">
            <h1 className="mb-4 font-[family-name:var(--font-poppins)] text-4xl font-bold tracking-tight sm:mb-5 sm:text-6xl md:mb-6 md:text-7xl lg:text-8xl">
              <span className="bg-gradient-to-b from-[#faf9f5] to-[#faf9f5]/75 bg-clip-text text-transparent">
                {title1}
              </span>
              <br />
              <span className="bg-gradient-to-r from-[#e8a090] via-[#faf9f5]/90 to-[#8ab4d9] bg-clip-text text-transparent">
                {title2}
              </span>
            </h1>
          </motion.div>

          <motion.div custom={2} variants={fadeUpVariants} initial="hidden" animate="visible">
            <p className="mx-auto mb-6 max-w-xl px-4 font-[family-name:var(--font-lora)] text-base font-light leading-relaxed tracking-wide text-[#faf9f5]/45 sm:mb-7 sm:text-lg md:text-xl">
              {description}
            </p>
          </motion.div>

          {children ? (
            <motion.div
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
            >
              {children}
            </motion.div>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center pb-5 pt-1 md:pb-6">
        <span className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#faf9f5]/35">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          className="text-[#faf9f5]/40"
          aria-hidden
        >
          <ChevronDown className="h-6 w-6" strokeWidth={1.5} />
        </motion.div>
      </div>
    </div>
  );
}

const ShapeLandingHero = HeroGeometric;

export { HeroGeometric, ShapeLandingHero };
