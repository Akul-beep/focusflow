import { CalendarDays, Sparkles, Timer } from "lucide-react";

function WeekCalendarPreview() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex h-full min-h-[200px] flex-col bg-[#faf9f5] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[#e8e6dc] pb-2">
        <CalendarDays className="h-4 w-4 text-[#d97757]" aria-hidden />
        <span className="font-[family-name:var(--font-poppins)] text-xs font-semibold text-[#141413]">This week</span>
      </div>
      <div className="flex justify-between gap-1">
        {days.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className={`flex h-10 w-9 items-center justify-center rounded-lg border font-[family-name:var(--font-poppins)] text-[11px] font-semibold shadow-sm ${
              i === 2
                ? "border-[#d97757]/45 bg-[#d97757]/[0.18] text-[#141413]"
                : "border-[#e8e6dc] bg-white text-[#141413]"
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {["Physics · Paper drill", "English · IO bullets", "Math · Review set"].map((t) => (
          <div
            key={t}
            className="flex items-center gap-2 rounded-lg border border-[#e8e6dc] bg-white px-3 py-2"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#788c5d]" aria-hidden />
            <span className="font-[family-name:var(--font-poppins)] text-[11px] font-medium text-[#141413]">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusTimerPreview() {
  const R = 52;
  const c = 2 * Math.PI * R;
  const pct = 0.45;
  const off = c * (1 - pct);
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center bg-[#faf9f5] p-4">
      <div className="mb-2 flex items-center gap-2">
        <Timer className="h-4 w-4 text-[#d97757]" aria-hidden />
        <span className="font-[family-name:var(--font-poppins)] text-xs font-semibold text-[#141413]">Focus</span>
      </div>
      <div className="relative h-[132px] w-[132px]">
        <svg className="-rotate-90" width={132} height={132} viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={R} fill="none" stroke="#e8e6dc" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke="#141413"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-poppins)] text-2xl font-bold tabular-nums text-[#141413]">
            13:42
          </span>
          <span className="font-[family-name:var(--font-poppins)] text-[9px] text-[#b0aea5]">session</span>
        </div>
      </div>
      <p className="mt-3 max-w-[200px] text-center font-[family-name:var(--font-poppins)] text-[10px] leading-snug text-[#6f6d66]">
        Timer, forest, and streak use the same screen as the live app.
      </p>
    </div>
  );
}

function AiStepsPreview() {
  return (
    <div className="flex h-full min-h-[200px] flex-col bg-[#faf9f5] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[#e8e6dc] pb-2">
        <Sparkles className="h-4 w-4 text-[#d97757]" aria-hidden />
        <span className="font-[family-name:var(--font-poppins)] text-xs font-semibold text-[#141413]">AI task input</span>
      </div>
      <div className="rounded-lg border border-[#e8e6dc] bg-white p-3">
        <p className="min-h-[2.75rem] font-[family-name:var(--font-lora)] text-[11px] leading-relaxed text-[#141413]">
          Chem lab: data and graph
          <span className="ml-0.5 font-[family-name:var(--font-poppins)] text-[#d97757]">|</span>
        </p>
      </div>
      <div className="mt-3 space-y-1.5">
        {["Outline variables", "Collect data", "Write analysis"].map((label, i) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-md border border-[#e8e6dc] bg-white px-2.5 py-1.5 opacity-100"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#e8e6dc] bg-[#faf9f5] font-[family-name:var(--font-poppins)] text-[9px] font-semibold text-[#141413]">
              {i + 1}
            </span>
            <span className="font-[family-name:var(--font-poppins)] text-[10px] font-medium text-[#141413]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CARDS = [
  {
    title: "Plans that match your week",
    body: "Your classes and deadlines stay visible so nothing important gets buried under busywork.",
    icon: CalendarDays,
    Preview: WeekCalendarPreview,
  },
  {
    title: "Focus without the guilt spiral",
    body: "Start a session in one tap and come back to a queue that still makes sense when you pause.",
    icon: Timer,
    Preview: FocusTimerPreview,
  },
  {
    title: "AI that shrinks the blank page",
    body: "Describe a task in plain language and get steps you can tick off instead of staring at a wall of text.",
    icon: Sparkles,
    Preview: AiStepsPreview,
  },
] as const;

/**
 * Feature grid with static previews (no motion).
 */
export function LandingFeatureStatic() {
  return (
    <ul className="mx-auto mt-14 grid max-w-6xl gap-8 md:grid-cols-3 md:gap-6">
      {CARDS.map((item) => {
        const Icon = item.icon;
        const Preview = item.Preview;
        return (
          <li
            key={item.title}
            className="flex flex-col overflow-hidden rounded-2xl border border-[#e8e6dc] bg-white shadow-[0_12px_40px_rgba(20,20,19,0.06)]"
          >
            <div className="relative aspect-[16/11] w-full overflow-hidden border-b border-[#e8e6dc] bg-white">
              <Preview />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#faf9f5] text-[#d97757]">
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="font-[family-name:var(--font-poppins)] text-xl font-semibold text-[#141413]">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[#b0aea5]">{item.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
