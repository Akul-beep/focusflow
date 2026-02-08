'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { CalendarEvent } from '@/types';

type FCEventInput = Record<string, unknown>;

interface CalendarViewProps {
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
}

export default function CalendarView({ onEventClick, onDateClick }: CalendarViewProps) {
  const { tasks, calendarEvents, updateCalendarEvent } = useStore();

  // Generate recurring events
  const allEvents = useMemo(() => {
    const events: FCEventInput[] = [];

    // Add calendar events
    calendarEvents.forEach((event) => {
      const start = event.start instanceof Date ? event.start : new Date(event.start);
      const end = event.end instanceof Date ? event.end : new Date(event.end);

      // Add the base event
      events.push({
        id: event.id,
        title: event.title,
        start: event.allDay ? start.toISOString().split('T')[0] : start.toISOString(),
        end: event.allDay ? end.toISOString().split('T')[0] : end.toISOString(),
        allDay: event.allDay,
        color: event.color,
        backgroundColor: event.color,
        borderColor: event.color,
        textColor: '#ffffff',
        extendedProps: {
          ...event,
          isCalendarEvent: true,
        },
      });

      // Generate recurring instances
      if (event.repeat) {
        const repeatEndDate = event.repeat.endDate || addYears(new Date(), 1);
        let currentDate = new Date(start);
        let instanceCount = 0;
        const maxInstances = 100; // Limit to prevent infinite loops

        while (currentDate <= repeatEndDate && instanceCount < maxInstances) {
          let nextDate: Date | null = null;

          switch (event.repeat.frequency) {
            case 'daily':
              nextDate = addDays(currentDate, event.repeat.interval);
              break;
            case 'weekly':
              if (event.repeat.daysOfWeek && event.repeat.daysOfWeek.length > 0) {
                // Find next occurrence on specified days
                let daysToAdd = 1;
                let found = false;
                while (!found && daysToAdd < 14) {
                  const checkDate = addDays(currentDate, daysToAdd);
                  if (event.repeat.daysOfWeek.includes(checkDate.getDay())) {
                    nextDate = checkDate;
                    found = true;
                  } else {
                    daysToAdd++;
                  }
                }
                if (!found) nextDate = addWeeks(currentDate, event.repeat.interval);
              } else {
                nextDate = addWeeks(currentDate, event.repeat.interval);
              }
              break;
            case 'monthly':
              nextDate = addMonths(currentDate, event.repeat.interval);
              break;
            case 'yearly':
              nextDate = addYears(currentDate, event.repeat.interval);
              break;
            default:
              nextDate = addDays(currentDate, event.repeat.interval);
          }

          if (nextDate && nextDate <= repeatEndDate) {
            const duration = end.getTime() - start.getTime();
            const nextEnd = new Date(nextDate.getTime() + duration);

            events.push({
              id: `${event.id}-${instanceCount}`,
              title: event.title,
              start: event.allDay ? nextDate.toISOString().split('T')[0] : nextDate.toISOString(),
              end: event.allDay ? nextEnd.toISOString().split('T')[0] : nextEnd.toISOString(),
              allDay: event.allDay,
              color: event.color,
              backgroundColor: event.color,
              borderColor: event.color,
              textColor: '#ffffff',
              extendedProps: {
                ...event,
                isCalendarEvent: true,
                isRecurring: true,
                originalId: event.id,
              },
            });

            currentDate = nextDate;
            instanceCount++;
          } else {
            break;
          }
        }
      }
    });

    // Add task micro-tasks as events (respect scheduledStart/scheduledEnd when available)
    tasks.forEach((task) => {
      if (task.completed) return;
      
      const taskDueDate = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
      
      task.microTasks
        .filter((mt) => !mt.completed)
        .forEach((microTask, idx) => {
          const scheduledStart =
            microTask.scheduledStart
              ? (microTask.scheduledStart instanceof Date ? microTask.scheduledStart : new Date(microTask.scheduledStart))
              : null;
          const scheduledEnd =
            microTask.scheduledEnd
              ? (microTask.scheduledEnd instanceof Date ? microTask.scheduledEnd : new Date(microTask.scheduledEnd))
              : null;

          const scheduledDate = microTask.scheduledDate
            ? (microTask.scheduledDate instanceof Date ? microTask.scheduledDate : new Date(microTask.scheduledDate))
            : scheduledStart
            ? scheduledStart
            : (() => {
                const daysUntilDue = Math.max(
                  1,
                  Math.ceil(
                    (taskDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  )
                );
                const fallbackDate = new Date(taskDueDate);
                fallbackDate.setDate(fallbackDate.getDate() - (daysUntilDue - idx - 1));
                return fallbackDate;
              })();

          events.push({
            id: `task-${microTask.id}`,
            title: `${task.title}: ${microTask.title}`,
            start: scheduledStart ? scheduledStart.toISOString() : scheduledDate.toISOString().split('T')[0],
            end: scheduledStart && scheduledEnd ? scheduledEnd.toISOString() : undefined,
            allDay: !scheduledStart,
            color: task.priority === 'high' ? '#D97757' : task.priority === 'medium' ? '#6A9BCC' : '#788C5D',
            backgroundColor: task.priority === 'high' ? '#D97757' : task.priority === 'medium' ? '#6A9BCC' : '#788C5D',
            borderColor: task.priority === 'high' ? '#D97757' : task.priority === 'medium' ? '#6A9BCC' : '#788C5D',
            textColor: '#ffffff',
            extendedProps: {
              taskId: task.id,
              microTaskId: microTask.id,
              priority: task.priority,
              isTask: true,
            },
          });
        });
    });

    return events;
  }, [tasks, calendarEvents]);

  const handleDateClick = (arg: unknown) => {
    const a = arg as { dateStr?: string };
    if (onDateClick) {
      onDateClick(new Date(String(a.dateStr)));
    }
  };

  const handleSelect = (arg: unknown) => {
    const a = arg as { start?: Date | string };
    // Prefer select (drag to create) for timeGrid; fallback to dateClick elsewhere.
    if (onDateClick) {
      onDateClick(new Date(a.start || new Date()));
    }
  };

  const handleEventClick = (arg: unknown) => {
    const a = arg as { event?: { id: string; extendedProps: Record<string, unknown> } };
    const ext = a.event?.extendedProps || {};
    if (ext.isCalendarEvent && onEventClick && a.event) {
      const originalId = ext.originalId as string | undefined;
      const event = calendarEvents.find(e => e.id === originalId || e.id === a.event!.id);
      if (event) {
        onEventClick(event);
      }
    }
  };

  const handleEventDrop = (arg: unknown) => {
    const a = arg as { event?: { id: string; start: Date | null; end: Date | null; allDay: boolean; extendedProps: Record<string, unknown> }; revert?: () => void };
    const ext = a.event?.extendedProps || {};
    if (!ext.isCalendarEvent || ext.isRecurring || !a.event?.start) {
      a.revert?.();
      return;
    }
    updateCalendarEvent(a.event.id, {
      start: new Date(a.event.start),
      end: a.event.end ? new Date(a.event.end) : new Date(a.event.start),
      allDay: a.event.allDay,
    });
  };

  const handleEventResize = (arg: unknown) => {
    const a = arg as { event?: { id: string; start: Date | null; end: Date | null; allDay: boolean; extendedProps: Record<string, unknown> }; revert?: () => void };
    const ext = a.event?.extendedProps || {};
    if (!ext.isCalendarEvent || ext.isRecurring || !a.event?.start) {
      a.revert?.();
      return;
    }
    updateCalendarEvent(a.event.id, {
      start: new Date(a.event.start),
      end: a.event.end ? new Date(a.event.end) : new Date(a.event.start),
      allDay: a.event.allDay,
    });
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-[#E8E6DC]">
      <div className="[&_.fc]:font-body [&_.fc-button]:font-heading [&_.fc-button]:text-sm [&_.fc-button]:px-4 [&_.fc-button]:py-2 [&_.fc-button]:rounded-lg [&_.fc-button]:border [&_.fc-button]:border-[#E8E6DC] [&_.fc-button]:bg-white [&_.fc-button]:text-[#141413] [&_.fc-button:hover]:bg-[#FAF9F5] [&_.fc-button-primary]:bg-white [&_.fc-button-primary]:text-[#141413] [&_.fc-button-primary]:border-[#E8E6DC] [&_.fc-button-primary:not(:disabled).fc-button-active]:bg-[#D97757] [&_.fc-button-primary:not(:disabled).fc-button-active]:text-white [&_.fc-button-primary:not(:disabled).fc-button-active]:border-[#D97757] [&_.fc-daygrid-day-header]:font-heading [&_.fc-daygrid-day-header]:font-semibold [&_.fc-daygrid-day-header]:text-[#141413] [&_.fc-daygrid-day-header]:bg-[#FAF9F5] [&_.fc-daygrid-day-number]:font-heading [&_.fc-daygrid-day-number]:text-[#141413] [&_.fc-timegrid-slot]:text-[#B0AEA5] [&_.fc-timegrid-col]:border-[#E8E6DC] [&_.fc-col-header-cell]:border-[#E8E6DC] [&_.fc-daygrid-day]:border-[#E8E6DC] [&_.fc-event]:cursor-pointer [&_.fc-event]:rounded-lg [&_.fc-event]:border-none [&_.fc-event-title]:font-heading [&_.fc-event-title]:font-medium [&_.fc-event-title]:text-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          events={allEvents}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'timeGridWeek,dayGridMonth,timeGridDay',
          }}
          height="auto"
          eventDisplay="block"
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          moreLinkClick="popover"
          dateClick={handleDateClick}
          select={handleSelect}
          eventClick={handleEventClick}
          eventAllow={(dropInfo, draggedEvent) => {
            if (!draggedEvent) return false;
            const ext = (draggedEvent.extendedProps || {}) as Record<string, unknown>;
            if (ext.isTask) return false;
            if (ext.isRecurring) return false;
            return !!ext.isCalendarEvent;
          }}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
          }}
          slotMinTime="06:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          allDaySlot={true}
          nowIndicator={true}
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
        />
      </div>
    </div>
  );
}
