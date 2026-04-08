const POINTS = [
  "Adaptive scheduling and rebalance when your workload will not sit still",
  "AI task breakdowns that land as real calendar blocks",
  "Syllabus-style exam prep plus Focus mode with forest and motivation",
] as const;

/**
 * Static value strip (replaces animated typewriter).
 */
export function LandingValueStrip() {
  return (
    <section
      className="border-y border-[#e8e6dc] bg-white py-12 md:py-14"
      aria-labelledby="value-strip-heading"
    >
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <h2 id="value-strip-heading" className="sr-only">
          What Flowly helps you do
        </h2>
        <p className="text-center font-[family-name:var(--font-poppins)] text-lg font-medium text-[#141413] md:text-xl">
          <span className="text-[#b0aea5]">AI scheduling that </span>
          <span className="text-[#d97757]">moves your calendar when you fall behind</span>
          <span className="text-[#b0aea5]">, not after you panic.</span>
        </p>
        <ul className="mt-8 space-y-3 text-center text-[15px] leading-relaxed text-[#6f6d66] md:mt-10 md:text-base">
          {POINTS.map((line) => (
            <li key={line} className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-2">
              <span className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-[#6a9bcc] sm:inline-block" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
