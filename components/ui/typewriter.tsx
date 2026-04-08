"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface TypewriterProps {
  text: string | string[];
  speed?: number;
  initialDelay?: number;
  waitTime?: number;
  deleteSpeed?: number;
  loop?: boolean;
  className?: string;
  showCursor?: boolean;
  hideCursorOnType?: boolean;
  cursorChar?: string | React.ReactNode;
  /** Variants must include `initial` and `animate` keys for the cursor span. */
  cursorAnimationVariants?: Variants;
  cursorClassName?: string;
}

const defaultCursorVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.01,
      repeat: Infinity,
      repeatDelay: 0.4,
      repeatType: "reverse",
    },
  },
};

const Typewriter = ({
  text,
  speed = 50,
  initialDelay = 0,
  waitTime = 2000,
  deleteSpeed = 30,
  loop = true,
  className,
  showCursor = true,
  hideCursorOnType = false,
  cursorChar = "|",
  cursorClassName = "ml-1",
  cursorAnimationVariants = defaultCursorVariants,
}: TypewriterProps) => {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  /** Only the first empty state uses `initialDelay` (avoids pausing between rotated lines). */
  const useInitialDelayNext = useRef(true);

  const texts = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const currentFullText = texts[currentTextIndex] ?? "";

    const startTyping = () => {
      if (isDeleting) {
        if (displayText === "") {
          setIsDeleting(false);
          if (currentTextIndex === texts.length - 1 && !loop) {
            return;
          }
          setCurrentTextIndex((prev) => (prev + 1) % texts.length);
          setCurrentIndex(0);
          timeout = setTimeout(() => {}, waitTime);
        } else {
          timeout = setTimeout(() => {
            setDisplayText((prev) => prev.slice(0, -1));
          }, deleteSpeed);
        }
      } else if (currentIndex < currentFullText.length) {
        timeout = setTimeout(() => {
          setDisplayText((prev) => prev + currentFullText[currentIndex]);
          setCurrentIndex((prev) => prev + 1);
        }, speed);
      } else if (texts.length > 1) {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, waitTime);
      }
    };

    if (currentIndex === 0 && !isDeleting && displayText === "") {
      const delay = useInitialDelayNext.current ? initialDelay : 0;
      useInitialDelayNext.current = false;
      timeout = setTimeout(startTyping, delay);
    } else {
      startTyping();
    }

    return () => clearTimeout(timeout);
  }, [
    currentIndex,
    displayText,
    isDeleting,
    speed,
    deleteSpeed,
    waitTime,
    texts,
    currentTextIndex,
    loop,
    initialDelay,
  ]);

  const currentFullText = texts[currentTextIndex] ?? "";

  return (
    <div className={cn("inline whitespace-pre-wrap tracking-tight", className)}>
      <span>{displayText}</span>
      {showCursor ? (
        <motion.span
          variants={cursorAnimationVariants}
          className={cn(
            cursorClassName,
            hideCursorOnType &&
              (currentIndex < currentFullText.length || isDeleting)
              ? "hidden"
              : ""
          )}
          initial="initial"
          animate="animate"
        >
          {cursorChar}
        </motion.span>
      ) : null}
    </div>
  );
};

export { Typewriter };
