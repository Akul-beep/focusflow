import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  Edit2,
  List,
  Play,
  Plus,
  ChevronRight,
  Sparkles,
  TreePine,
  Flame,
} from 'lucide-react';
import PageHeader, { PAGE_MAIN_CLASSES } from '@/components/PageHeader';
import { MAIN_NAV } from '@/lib/nav-config';

const MOCK_TREES = [
  { id: 0, x: 22, size: 1, color: '#788C5D' },
  { id: 1, x: 48, size: 0.85, color: '#6A9BCC' },
  { id: 2, x: 72, size: 1, color: '#5A7A4E' },
] as const;

function MockTaskCard({
  title,
  description,
  priority,
  dueLabel,
  scheduleLabel,
  subject,
  completedMicro,
  totalMicro,
  completed,
  accent,
}: {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueLabel: string;
  scheduleLabel?: string;
  subject?: string;
  completedMicro: number;
  totalMicro: number;
  completed?: boolean;
  accent: 'high' | 'medium' | 'low';
}) {
  const priorityStyles = {
    high: 'bg-[#D97757]/12 text-[#b8654a] border-[#D97757]/25',
    medium: 'bg-[#6A9BCC]/12 text-[#4a7aad] border-[#6A9BCC]/25',
    low: 'bg-[#788C5D]/12 text-[#5f6e49] border-[#788C5D]/25',
  } as const;
  const accentBar = {
    high: 'bg-[#D97757]',
    medium: 'bg-[#6A9BCC]',
    low: 'bg-[#788C5D]',
  } as const;
  const progress = totalMicro > 0 ? completedMicro / totalMicro : 0;

  return (
    <div
      className={`relative flex rounded-xl border bg-white shadow-sm border-[#E8E6DC] overflow-hidden ${
        completed ? 'opacity-[0.72]' : ''
      }`}
    >
      <div
        className={`w-1 shrink-0 ${completed ? 'bg-[#E8E6DC]' : accentBar[accent]}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-1.5 rounded-lg text-[#B0AEA5]">
            <ChevronDown className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <h3
                    className={`font-heading font-semibold text-base sm:text-[17px] text-[#141413] leading-snug ${
                      completed ? 'line-through text-[#B0AEA5]' : ''
                    }`}
                  >
                    {title}
                  </h3>
                  {!completed && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-heading font-semibold uppercase tracking-wide border ${priorityStyles[priority]}`}
                    >
                      {priority}
                    </span>
                  )}
                </div>
                {description ? (
                  <p className="text-sm text-[#6f6d66] mt-1.5 leading-relaxed font-body">{description}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end shrink-0">
                <span className="px-3 py-1.5 rounded-lg text-xs font-heading font-semibold bg-[#788C5D] text-white">
                  Mark done
                </span>
                <span className="p-2 text-[#B0AEA5] rounded-lg" aria-hidden>
                  <Edit2 className="w-4 h-4" />
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-heading text-[#6A9BCC] font-semibold">
                <Calendar className="w-4 h-4 shrink-0 opacity-80" />
                {dueLabel}
                <span className="text-xs font-medium">· due today</span>
              </span>
              {scheduleLabel ? (
                <span className="inline-flex items-center gap-1.5 text-[#B0AEA5] font-heading">
                  <Clock className="w-4 h-4 shrink-0 opacity-80" />
                  {scheduleLabel}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 text-[#B0AEA5] font-heading">
                <Clock className="w-4 h-4 shrink-0 opacity-80" />
                ~2h total
              </span>
              {subject ? (
                <span className="px-2.5 py-0.5 rounded-md bg-[#FAF9F5] border border-[#E8E6DC] text-xs font-heading font-medium text-[#141413]">
                  {subject}
                </span>
              ) : null}
            </div>
            {totalMicro > 0 ? (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-heading font-medium text-[#141413]">
                    {completedMicro} of {totalMicro} steps
                  </span>
                  <span className="text-sm font-heading font-bold text-[#6A9BCC] tabular-nums">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <div className="h-2 w-full bg-[#E8E6DC] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${completed ? 'bg-[#788C5D]' : 'bg-[#D97757]'}`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingForestMock() {
  return (
    <div className="bg-white border border-[#E8E6DC] rounded-lg p-3 shadow-none">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-md bg-gradient-to-br from-[#788C5D]/15 to-[#6A9BCC]/15 flex items-center justify-center w-8 h-8">
          <TreePine className="text-[#788C5D] w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-medium text-[#141413] text-sm">Growth forest</h3>
        </div>
      </div>
      <div className="relative mb-3">
        <div className="relative h-28 bg-gradient-to-b from-[#FAF9F5] to-[#E8E6DC] rounded-lg overflow-hidden border border-[#E8E6DC]">
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#788C5D]/30 to-transparent" />
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {MOCK_TREES.map((tree) => {
              const treeHeight = 15 + tree.size * 25;
              const treeWidth = 3 + tree.size * 4;
              const trunkHeight = treeHeight * 0.4;
              const crownHeight = treeHeight * 0.6;
              return (
                <g
                  key={tree.id}
                  transform={`translate(${tree.x}, ${100 - trunkHeight - crownHeight * tree.size})`}
                >
                  <ellipse
                    cx="0"
                    cy="0"
                    rx={treeWidth * 1.5}
                    ry={crownHeight * 0.8}
                    fill={tree.color}
                    opacity={0.8}
                  />
                  <ellipse
                    cx={-treeWidth * 0.6}
                    cy={-crownHeight * 0.2}
                    rx={treeWidth * 1.2}
                    ry={crownHeight * 0.6}
                    fill={tree.color}
                    opacity={0.6}
                  />
                  <ellipse
                    cx={treeWidth * 0.6}
                    cy={-crownHeight * 0.2}
                    rx={treeWidth * 1.2}
                    ry={crownHeight * 0.6}
                    fill={tree.color}
                    opacity={0.6}
                  />
                  <rect
                    x={-treeWidth * 0.3}
                    y={0}
                    width={treeWidth * 0.6}
                    height={trunkHeight}
                    fill="#5A4A3A"
                    opacity={0.9}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-heading text-[#141413] text-xs">Trees planted</span>
          <span className="font-heading font-semibold text-[#141413] text-sm">3</span>
        </div>
        <div className="flex items-center justify-between text-[#B0AEA5] text-[10px]">
          <span>142 min growth</span>
          <span>Next 8 min</span>
        </div>
        <div className="w-full bg-[#E8E6DC] rounded-full overflow-hidden h-1">
          <div className="h-full bg-[#788C5D] rounded-full w-[66%]" />
        </div>
        <div className="flex items-center justify-between text-[#B0AEA5] font-heading text-[10px]">
          <span>2/3 ticks</span>
          <span>+1 / 10 min</span>
        </div>
      </div>
      <div className="mt-2.5 block text-center text-[10px] font-heading font-semibold text-[#6A9BCC] pt-2 border-t border-[#E8E6DC]/80">
        Focus timer grows this forest →
      </div>
    </div>
  );
}

function LandingMotivationMock() {
  return (
    <div className="bg-white border border-[#E8E6DC] rounded-lg p-3 shadow-none">
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-md bg-gradient-to-br from-[#6A9BCC]/15 to-[#788C5D]/15 flex items-center justify-center w-7 h-7">
          <Sparkles className="text-[#6A9BCC] w-3.5 h-3.5" />
        </div>
        <h3 className="font-heading text-[#141413] text-sm font-medium">Today</h3>
      </div>
      <div className="bg-[#FAF9F5] rounded-md border border-[#E8E6DC]/80 mb-2 p-2.5">
        <p className="font-body text-[#141413] leading-relaxed text-xs">
          Small steps today beat a perfect plan you never touch.
        </p>
      </div>
      <div className="bg-[#FAF9F5] rounded-md border border-[#E8E6DC]/80 space-y-1 p-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="text-[#D97757] w-3.5 h-3.5" />
            <div>
              <div className="text-[10px] text-[#B0AEA5] font-heading uppercase tracking-wide">Streak</div>
              <div className="font-heading font-semibold text-[#141413] text-sm">4 days</div>
            </div>
          </div>
        </div>
        <p className="text-[#B0AEA5] leading-snug text-[10px]">
          One completed focus session per day keeps the streak (Pomodoro on the Focus page).
        </p>
      </div>
    </div>
  );
}

/**
 * Static, non-interactive replica of the signed-in dashboard for marketing / landing previews.
 */
export function DashboardScreenMock() {
  const statsChip = (
    <div className="flex items-center gap-2.5 h-10 shrink-0 rounded-lg bg-[#FAF9F5] border border-[#E8E6DC] px-2.5">
      <div className="w-32">
        <div className="flex items-center justify-between text-[10px] font-heading leading-none">
          <span className="text-[#B0AEA5]">Done</span>
          <span className="text-[#141413] font-semibold tabular-nums">2/5</span>
        </div>
        <div className="mt-1 h-1 w-full bg-[#E8E6DC] rounded-full overflow-hidden">
          <div className="h-full bg-[#D97757] rounded-full w-[40%]" />
        </div>
      </div>
      <span className="hidden xl:block w-px h-6 bg-[#E8E6DC] shrink-0" aria-hidden />
      <div className="hidden xl:flex items-center gap-2 shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#D97757]/10 flex items-center justify-center">
          <Coins className="w-3.5 h-3.5 text-[#D97757]" />
        </div>
        <div className="text-xs font-heading font-semibold text-[#141413] tabular-nums leading-tight pr-0.5">
          128<span className="text-[#B0AEA5] font-medium"> · L4</span>
          <span className="text-[#B0AEA5] font-normal"> · +12</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[800px] w-[1360px] shrink-0 bg-[#FAF9F5] text-left">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-white border-r border-[#E8E6DC]">
        <div className="p-4 border-b border-[#E8E6DC]">
          <div className="flex items-center gap-2.5 rounded-lg -m-1 p-1">
            <div>
              <h1 className="font-heading font-bold text-lg text-[#141413]">Flowly</h1>
              <p className="text-xs text-[#B0AEA5]">Task Management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-hidden min-h-0">
          {MAIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/dashboard';
            return (
              <div
                key={item.href}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-heading font-medium text-sm ${
                  isActive
                    ? 'bg-[#D97757] text-white shadow-sm'
                    : 'text-[#141413]'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-[#B0AEA5]'}`} />
                <span className="flex-1 truncate">{item.label}</span>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-[#E8E6DC] shrink-0">
          <div className="bg-gradient-to-br from-[#FAF9F5] to-[#E8E6DC] rounded-xl p-3">
            <div className="rounded-lg border border-[#E8E6DC] bg-white px-3 py-2 text-xs text-[#B0AEA5] font-body">
              Describe a task…
            </div>
            <div className="mt-2 flex justify-end">
              <div className="h-8 w-8 rounded-lg bg-[#141413] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white opacity-90" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <PageHeader
          className="shadow-[0_1px_0_rgba(20,20,19,0.04)] shrink-0"
          title="Dashboard"
          subtitle={
            <span className="text-[#6f6d66]">
              You&apos;ve got 3 things in motion. Pick one and chip away.
            </span>
          }
          actions={
            <>
              <div className="hidden lg:flex items-center gap-2">{statsChip}</div>
              <div className="h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-[#D97757] text-white font-heading font-semibold text-sm shadow-sm shrink-0">
                <Play className="w-4 h-4" />
                Start focus timer
              </div>
              <div className="hidden lg:flex flex-wrap items-center justify-end gap-2">
                <div className="w-full lg:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-[#E8E6DC] bg-white text-[#141413] font-heading font-medium text-sm">
                  <Plus className="w-4 h-4" />
                  Add task
                </div>
                <div className="w-full lg:w-auto h-10 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-[#E8E6DC] bg-white text-[#141413] font-heading font-medium text-sm">
                  <List className="w-4 h-4" />
                  Pick step
                </div>
              </div>
            </>
          }
        />

        <main className={`${PAGE_MAIN_CLASSES} flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-4`}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-[#E8E6DC] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#6A9BCC]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-[18px] h-[18px] text-[#6A9BCC]" />
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold text-[#141413] tabular-nums leading-none">3</div>
                  <div className="text-xs text-[#B0AEA5] font-heading mt-1">Active</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[#E8E6DC] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#D97757]/10 flex items-center justify-center">
                  <AlertCircle className="w-[18px] h-[18px] text-[#D97757]" />
                </div>
                <div>
                  <div className="text-2xl font-heading font-bold text-[#141413] tabular-nums leading-none">1</div>
                  <div className="text-xs text-[#B0AEA5] font-heading mt-1">Overdue</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 min-h-0">
            <div className="lg:col-span-9 space-y-5 min-w-0">
              <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-[#E8E6DC]/40 border border-[#E8E6DC]/80">
                {(
                  [
                    ['all', 'All tasks', '5'],
                    ['active', 'Active', '3'],
                    ['overdue', 'Overdue', '1'],
                    ['done', 'Done', '2'],
                  ] as const
                ).map(([key, label, count]) => (
                  <div
                    key={key}
                    className={`px-3.5 py-2 rounded-lg font-heading text-sm font-medium ${
                      key === 'all'
                        ? 'bg-white text-[#141413] shadow-sm border border-[#E8E6DC]'
                        : 'text-[#6f6d66]'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`ml-1.5 tabular-nums text-xs ${
                        key === 'all' ? 'text-[#B0AEA5]' : 'text-[#B0AEA5]/80'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <MockTaskCard
                  title="HL Physics: past paper walkthrough"
                  description="Timed Section A, then mark using the markscheme."
                  priority="high"
                  accent="high"
                  dueLabel="Apr 5, 2026"
                  scheduleLabel="Today, 4:30 PM"
                  subject="Physics HL"
                  completedMicro={1}
                  totalMicro={4}
                />
                <MockTaskCard
                  title="English IO outline"
                  description="Global issue + extracts; bullet talking points only."
                  priority="medium"
                  accent="medium"
                  dueLabel="Apr 8, 2026"
                  scheduleLabel="Tomorrow, 3:00 PM"
                  subject="English"
                  completedMicro={2}
                  totalMicro={5}
                />
              </div>
            </div>

            <div className="lg:col-span-3 relative min-w-0 max-w-full">
              <div className="lg:absolute lg:-left-2.5 lg:top-0 z-10 w-8 h-8 bg-white border border-[#E8E6DC] rounded-full flex items-center justify-center shadow-sm mb-3 lg:mb-0 text-[#B0AEA5]">
                <ChevronRight className="w-4 h-4" />
              </div>
              <div className="space-y-4 pt-1">
                <LandingForestMock />
                <LandingMotivationMock />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
