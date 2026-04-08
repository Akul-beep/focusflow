'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { CalendarEvent } from '@/types';
import {
  buildScheduleCalendarItems,
  defaultColorForEventType,
  firstLineTitle,
  itemIntersectsDay,
  tooltipForItem,
  type ScheduleCalendarItem,
} from '@/lib/schedule-calendar-events';

export type ScheduleCalendarProps = {
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onTaskClick?: (taskId: string, microTaskId: string, clusterMicroTaskIds?: string[]) => void;
};

type ViewMode = 'month' | 'week' | 'day';

const WEEK_OPTS = { weekStartsOn: 0 as const };
const VISIBLE_START = 6;
/** End of the time axis (24 = midnight). Was 22 so everything after 10pm was clipped. */
const VISIBLE_END = 24;
const SLOT_MINUTES = (VISIBLE_END - VISIBLE_START) * 60;
const MONTH_MAX_CHIPS = 3;
/** Taller hour rows in week/day only; does not widen the outer layout column. */
const PX_PER_HOUR = 58;
/** Time labels column — slightly wider so “10 AM” stays readable. */
const TIME_GUTTER_PX = 52;

function minutesFromMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function timedLayoutForDay(day: Date, items: ScheduleCalendarItem[]) {
  const timed = items
    .filter((i) => !i.allDay && itemIntersectsDay(i, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEnds: number[] = [];
  const placed: { item: ScheduleCalendarItem; col: number }[] = [];
  for (const item of timed) {
    const s = item.start.getTime();
    const e = item.end.getTime();
    let c = 0;
    while (c < laneEnds.length && laneEnds[c] !== undefined && laneEnds[c] > s) c++;
    laneEnds[c] = e;
    placed.push({ item, col: c });
  }
  const colCount = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, colCount }));
}

function eventBlockStyle(item: ScheduleCalendarItem, day: Date): { top: string; height: string } {
  const ds = startOfDay(day);
  const de = addDays(ds, 1);
  const start = Math.max(item.start.getTime(), ds.getTime());
  const end = Math.min(item.end.getTime(), de.getTime());
  const vis0 = VISIBLE_START * 60;
  const vis1 = VISIBLE_END * 60;
  let m0 = minutesFromMidnight(new Date(start));
  let m1 = minutesFromMidnight(new Date(end));
  m0 = Math.max(vis0, Math.min(vis1, m0));
  m1 = Math.max(vis0, Math.min(vis1, m1));
  if (m1 <= m0) m1 = m0 + 15;
  const top = ((m0 - vis0) / SLOT_MINUTES) * 100;
  const h = ((m1 - m0) / SLOT_MINUTES) * 100;
  return { top: `${top}%`, height: `${Math.max(h, 1.2)}%` };
}

function rangeForView(view: ViewMode, anchor: Date): { rangeStart: Date; rangeEndExclusive: Date } {
  if (view === 'month') {
    const ms = startOfMonth(anchor);
    const me = endOfMonth(anchor);
    const gridStart = startOfWeek(ms, WEEK_OPTS);
    const gridEnd = endOfWeek(me, WEEK_OPTS);
    return {
      rangeStart: addDays(gridStart, -14),
      rangeEndExclusive: addDays(addDays(gridEnd, 1), 14),
    };
  }
  if (view === 'week') {
    const ws = startOfWeek(anchor, WEEK_OPTS);
    const we = endOfWeek(anchor, WEEK_OPTS);
    return {
      rangeStart: addDays(ws, -7),
      rangeEndExclusive: addDays(addDays(we, 1), 7),
    };
  }
  const d0 = startOfDay(anchor);
  return {
    rangeStart: addDays(d0, -7),
    rangeEndExclusive: addDays(d0, 8),
  };
}

function titleForView(view: ViewMode, anchor: Date): string {
  if (view === 'month') return format(anchor, 'MMMM yyyy');
  if (view === 'week') {
    const ws = startOfWeek(anchor, WEEK_OPTS);
    const we = endOfWeek(anchor, WEEK_OPTS);
    return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
  }
  return format(anchor, 'EEEE, MMMM d, yyyy');
}

export default function ScheduleCalendar({
  onDateClick,
  onEventClick,
  onTaskClick,
}: ScheduleCalendarProps) {
  const { tasks, calendarEvents, schedulePreferences } = useStore();
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [moreDay, setMoreDay] = useState<Date | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const { rangeStart, rangeEndExclusive } = useMemo(() => rangeForView(view, anchor), [view, anchor]);

  const items = useMemo(
    () =>
      buildScheduleCalendarItems({
        rangeStart,
        rangeEndExclusive,
        tasks,
        calendarEvents,
        bufferMinutes: schedulePreferences.bufferMinutes || 5,
        calendarTaskColor: schedulePreferences.calendarTaskColor,
        calendarEventColor: schedulePreferences.calendarEventColor,
      }),
    [
      rangeStart,
      rangeEndExclusive,
      tasks,
      calendarEvents,
      schedulePreferences.bufferMinutes,
      schedulePreferences.calendarTaskColor,
      schedulePreferences.calendarEventColor,
    ]
  );

  const goToday = useCallback(() => setAnchor(new Date()), []);
  const goPrev = useCallback(() => {
    setAnchor((d) => (view === 'month' ? addMonths(d, -1) : view === 'week' ? addWeeks(d, -1) : addDays(d, -1)));
  }, [view]);
  const goNext = useCallback(() => {
    setAnchor((d) => (view === 'month' ? addMonths(d, 1) : view === 'week' ? addWeeks(d, 1) : addDays(d, 1)));
  }, [view]);

  const handleItemClick = useCallback(
    (item: ScheduleCalendarItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.kind === 'calendar' && item.calendarEvent && onEventClick) onEventClick(item.calendarEvent);
      if (item.kind === 'task' && item.taskId && item.microTaskId && onTaskClick) {
        const ids = item.clusterMicroTaskIds;
        onTaskClick(item.taskId, item.microTaskId, ids && ids.length > 1 ? ids : undefined);
      }
    },
    [onEventClick, onTaskClick]
  );

  const handleDayBackgroundClick = useCallback(
    (day: Date) => {
      onDateClick?.(startOfDay(day));
    },
    [onDateClick]
  );

  useEffect(() => {
    if (!moreDay) return;
    const close = (ev: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(ev.target as Node)) setMoreDay(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreDay]);

  useEffect(() => {
    if (!hoverTip) return;
    const onMove = (e: MouseEvent) => {
      setHoverTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [hoverTip?.text]);

  const monthGridDays = useMemo(() => {
    const ms = startOfMonth(anchor);
    const me = endOfMonth(anchor);
    const gridStart = startOfWeek(ms, WEEK_OPTS);
    const gridEnd = endOfWeek(me, WEEK_OPTS);
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [anchor]);

  const weekDays = useMemo(() => {
    const ws = startOfWeek(anchor, WEEK_OPTS);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [anchor]);

  const dayOnly = useMemo(() => startOfDay(anchor), [anchor]);

  const hours = useMemo(
    () => Array.from({ length: VISIBLE_END - VISIBLE_START }, (_, i) => VISIBLE_START + i),
    []
  );

  const toolbarTitle = titleForView(view, anchor);

  const btnBase =
    'rounded-lg border border-[#E8E6DC] bg-white px-3 py-2 text-sm font-heading font-medium text-[#141413] hover:bg-[#FAF9F5] transition-colors';

  const timeGridHeightPx = (VISIBLE_END - VISIBLE_START) * PX_PER_HOUR;

  const eventLegendTypes: CalendarEvent['eventType'][] = ['class', 'meeting', 'study', 'event', 'task', 'other'];

  return (
    <div className="schedule-view-card bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-[#E8E6DC] w-full min-w-0">
      <div className="mb-4">
        <h2 className="font-heading font-semibold text-xl text-[#141413]">Schedule</h2>
        <p className="mt-1 text-xs text-[#B0AEA5] leading-relaxed">
          Click a day cell or empty time area to load that day in the sidebar. Click a colored block to open details.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-label="Previous" onClick={goPrev} className={btnBase}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={goToday} className={btnBase}>
            Today
          </button>
          <button type="button" aria-label="Next" onClick={goNext} className={btnBase}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <h3 className="text-center sm:text-left font-heading font-semibold text-lg text-[#141413] min-w-[12rem]">
          {toolbarTitle}
        </h3>
        <div className="flex rounded-lg border border-[#E8E6DC] overflow-hidden">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 sm:px-4 py-2 text-sm font-heading font-medium capitalize ${
                view === v ? 'bg-[#D97757] text-white' : 'bg-white text-[#141413] hover:bg-[#FAF9F5]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <div className="rounded-lg border border-[#E8E6DC] overflow-hidden bg-[#FAF9F5]/40">
          <div className="grid grid-cols-7 border-b border-[#E8E6DC] bg-white">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-heading font-semibold text-[#B0AEA5]">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr bg-white">
            {monthGridDays.map((day) => {
              const dayItems = items
                .filter((it) => itemIntersectsDay(it, day))
                .sort((a, b) => {
                  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                  return a.start.getTime() - b.start.getTime();
                });
              const visible = dayItems.slice(0, MONTH_MAX_CHIPS);
              const hiddenCount = dayItems.length - visible.length;

              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleDayBackgroundClick(day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDayBackgroundClick(day);
                    }
                  }}
                  aria-label={`${format(day, 'EEEE, MMMM d')}. Select this day for the sidebar agenda.`}
                  className={`min-h-[5.5rem] sm:min-h-[6.25rem] border-b border-r border-[#E8E6DC] p-1 flex flex-col cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D97757]/50 ${
                    !isSameMonth(day, anchor) ? 'bg-[#FAF9F5]/80' : 'hover:bg-[#FAF9F5]/90'
                  }`}
                >
                  <div
                    className={`mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-heading font-semibold pointer-events-none ${
                      isToday(day)
                        ? 'bg-[#D97757] text-white'
                        : isSameMonth(day, anchor)
                          ? 'text-[#141413]'
                          : 'text-[#B0AEA5]'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="flex flex-col gap-0.5 min-h-0 flex-1">
                    {visible.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={(e) => handleItemClick(it, e)}
                        onMouseEnter={(e) =>
                          setHoverTip({ x: e.clientX, y: e.clientY, text: tooltipForItem(it) })
                        }
                        onMouseLeave={() => setHoverTip(null)}
                        className="text-left text-[11px] sm:text-xs leading-tight truncate rounded px-1 py-0.5 border border-black/10 shadow-sm hover:brightness-95"
                        style={{
                          backgroundColor: it.color,
                          borderLeftWidth: 3,
                          borderLeftColor: it.color,
                          color: '#141413',
                        }}
                      >
                        {!it.allDay ? `${format(it.start, 'h:mm a')} ` : ''}
                        {firstLineTitle(it.title)}
                      </button>
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoreDay(day);
                        }}
                        className="text-left text-[11px] font-heading font-semibold text-[#D97757] hover:underline px-1"
                      >
                        +{hiddenCount} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(view === 'week' || view === 'day') && (
        <div className="rounded-lg border border-[#E8E6DC] overflow-x-auto overflow-y-clip bg-white overscroll-x-contain">
          <div className="min-w-[640px]">
            <div
              className="grid gap-px bg-[#E8E6DC]"
              style={{
                gridTemplateColumns:
                  view === 'day' ? `${TIME_GUTTER_PX}px 1fr` : `${TIME_GUTTER_PX}px repeat(7, minmax(88px,1fr))`,
              }}
            >
              <div className="bg-[#FAF9F5] h-11" />
              {(view === 'day' ? [dayOnly] : weekDays).map((d) => (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => handleDayBackgroundClick(d)}
                  aria-label={`${format(d, 'EEEE, MMMM d')}. Select this day for the sidebar agenda.`}
                  className={`bg-[#FAF9F5] h-11 flex flex-col items-center justify-center border-l border-[#E8E6DC] hover:bg-[#F0EFE8] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D97757]/50 ${
                    isToday(d) ? 'ring-1 ring-inset ring-[#D97757]/50' : ''
                  }`}
                >
                  <span className="text-[10px] font-heading font-semibold text-[#B0AEA5] uppercase">{format(d, 'EEE')}</span>
                  <span
                    className={`text-sm font-heading font-semibold ${
                      isToday(d) ? 'text-[#D97757]' : 'text-[#141413]'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>
                </button>
              ))}
            </div>

            <div
              className="grid gap-px bg-[#E8E6DC] border-t border-[#E8E6DC]"
              style={{
                gridTemplateColumns:
                  view === 'day' ? `${TIME_GUTTER_PX}px 1fr` : `${TIME_GUTTER_PX}px repeat(7, minmax(88px,1fr))`,
              }}
            >
              <div className="bg-[#FAF9F5] min-h-[2.75rem] text-[10px] text-[#B0AEA5] flex items-center justify-center font-heading">
                all-day
              </div>
              {(view === 'day' ? [dayOnly] : weekDays).map((d) => {
                const allDay = items.filter((it) => it.allDay && itemIntersectsDay(it, d));
                return (
                  <div
                    key={`ad-${d.toISOString()}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      handleDayBackgroundClick(d);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleDayBackgroundClick(d);
                      }
                    }}
                    aria-label={`All-day row for ${format(d, 'MMM d')}. Select this day.`}
                    className="bg-white min-h-[2.75rem] p-0.5 flex flex-col gap-0.5 border-l border-[#E8E6DC] cursor-pointer hover:bg-[#FAF9F5]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D97757]/40"
                  >
                    {allDay.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={(e) => handleItemClick(it, e)}
                        onMouseEnter={(e) =>
                          setHoverTip({ x: e.clientX, y: e.clientY, text: tooltipForItem(it) })
                        }
                        onMouseLeave={() => setHoverTip(null)}
                        className="text-left text-[10px] truncate rounded px-1 py-0.5 border border-black/10"
                        style={{ backgroundColor: it.color, color: '#141413' }}
                      >
                        {firstLineTitle(it.title)}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            <div
              className="grid gap-px bg-[#E8E6DC]"
              style={{
                gridTemplateColumns:
                  view === 'day' ? `${TIME_GUTTER_PX}px 1fr` : `${TIME_GUTTER_PX}px repeat(7, minmax(88px,1fr))`,
              }}
            >
              <div className="bg-white relative" style={{ height: `${timeGridHeightPx}px` }}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 text-[11px] text-[#B0AEA5] pr-1 text-right font-heading border-t border-[#E8E6DC]/80"
                    style={{ top: `${((h - VISIBLE_START) / (VISIBLE_END - VISIBLE_START)) * 100}%` }}
                  >
                    {format(new Date(2000, 0, 1, h), 'h a')}
                  </div>
                ))}
              </div>
              {(view === 'day' ? [dayOnly] : weekDays).map((d) => {
                const placed = timedLayoutForDay(d, items);
                return (
                  <div
                    key={`tg-${d.toISOString()}`}
                    className="bg-white relative border-l border-[#E8E6DC] cursor-pointer hover:bg-[#FAF9F5]/30"
                    style={{ height: `${timeGridHeightPx}px` }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return;
                      handleDayBackgroundClick(d);
                    }}
                    role="presentation"
                  >
                    {hours.map((h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-t border-[#E8E6DC]/60 pointer-events-none"
                        style={{ top: `${((h - VISIBLE_START) / (VISIBLE_END - VISIBLE_START)) * 100}%` }}
                      />
                    ))}
                    {placed.map(({ item, col, colCount }) => {
                      const { top, height } = eventBlockStyle(item, d);
                      const w = 100 / colCount;
                      const left = col * w;
                      return (
                        <button
                          key={item.id + String(col)}
                          type="button"
                          onClick={(e) => handleItemClick(item, e)}
                          onMouseEnter={(e) =>
                            setHoverTip({ x: e.clientX, y: e.clientY, text: tooltipForItem(item) })
                          }
                          onMouseLeave={() => setHoverTip(null)}
                          className="absolute overflow-hidden text-left text-[11px] leading-snug px-1 py-0.5 rounded border border-black/10 shadow-sm hover:brightness-95 z-[1]"
                          style={{
                            top,
                            height,
                            left: `${left + 0.25}%`,
                            width: `${w - 0.5}%`,
                            backgroundColor: item.color,
                            color: '#141413',
                          }}
                        >
                          {firstLineTitle(item.title)}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-[#E8E6DC]">
        <p className="text-[10px] font-heading font-semibold text-[#141413] mb-2">Color guide</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#B0AEA5] font-body">
            <span className="font-heading font-medium text-[#141413] shrink-0">Study tasks</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm shrink-0 bg-[#D97757]" />
              High
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm shrink-0 bg-[#6A9BCC]" />
              Medium
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm shrink-0 bg-[#788C5D]" />
              Low
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#B0AEA5] font-body min-w-0">
            <span className="font-heading font-medium text-[#141413] shrink-0">Calendar events</span>
            {eventLegendTypes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 shrink-0">
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: defaultColorForEventType(t) }}
                />
                {t === 'task' ? 'Task (event)' : t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[10px] text-[#B0AEA5] leading-snug">
          Custom colors on each event, or Settings → calendar event color, override the type defaults.
        </p>
      </div>

      {moreDay &&
        createPortal(
          <div
            ref={moreRef}
            className="fixed z-[100001] w-72 max-h-80 overflow-y-auto rounded-xl border border-[#E8E6DC] bg-white p-3 shadow-xl"
            style={{ left: '50%', top: '30%', transform: 'translate(-50%, 0)' }}
          >
            <p className="text-xs font-heading font-semibold text-[#141413] mb-2">{format(moreDay, 'EEEE, MMM d')}</p>
            <ul className="space-y-1">
              {items
                .filter((it) => itemIntersectsDay(it, moreDay))
                .sort((a, b) => {
                  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
                  return a.start.getTime() - b.start.getTime();
                })
                .map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (it.kind === 'calendar' && it.calendarEvent && onEventClick) onEventClick(it.calendarEvent);
                        if (it.kind === 'task' && it.taskId && it.microTaskId && onTaskClick) {
                          const ids = it.clusterMicroTaskIds;
                          onTaskClick(it.taskId, it.microTaskId, ids && ids.length > 1 ? ids : undefined);
                        }
                        setMoreDay(null);
                      }}
                      className="w-full text-left text-sm rounded-lg px-2 py-1.5 hover:bg-[#FAF9F5]"
                    >
                      <span className="font-heading font-medium text-[#141413]">{firstLineTitle(it.title)}</span>
                      <span className="block text-xs text-[#B0AEA5]">
                        {it.allDay ? 'All day' : `${format(it.start, 'h:mm a')} – ${format(it.end, 'h:mm a')}`}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>,
          document.body
        )}

      {hoverTip &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[100000] max-w-sm rounded-lg border border-[#E8E6DC] bg-white px-3 py-2 shadow-lg pointer-events-none text-left"
            style={{ left: hoverTip.x + 14, top: hoverTip.y + 14 }}
          >
            <p className="text-xs text-[#141413] font-body whitespace-pre-wrap leading-relaxed">{hoverTip.text}</p>
          </div>,
          document.body
        )}
    </div>
  );
}
