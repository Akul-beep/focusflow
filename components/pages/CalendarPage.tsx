'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import CalendarView from '@/components/CalendarView';
import DailyMotivation from '@/components/DailyMotivation';
import CalendarEventModal from '@/components/CalendarEventModal';
import { Plus } from 'lucide-react';
import { CalendarEvent } from '@/types';
import { format } from 'date-fns';
import Link from 'next/link';
import { getDayAgenda } from '@/lib/agenda';

export default function CalendarPage() {
  const { deleteCalendarEvent, tasks, calendarEvents } = useStore();
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | undefined>();

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(undefined);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleDelete = () => {
    if (selectedEvent && confirm('Are you sure you want to delete this event?')) {
      deleteCalendarEvent(selectedEvent.id);
      setShowEventModal(false);
      setSelectedEvent(undefined);
    }
  };

  const day = selectedDate;
  const dayAgenda = useMemo(() => {
    return getDayAgenda({ day, tasks, calendarEvents });
  }, [day, tasks, calendarEvents]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex">
      <Sidebar />

      <div className="flex-1 ml-64">
        <header className="bg-white border-b border-[#E8E6DC] sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-heading font-bold text-3xl text-[#141413] mb-1">Calendar</h1>
                <p className="text-sm text-[#B0AEA5]">Manage your schedule, classes, and events</p>
              </div>
              <button
                onClick={() => {
                  setSelectedDate(new Date());
                  setSelectedEvent(undefined);
                  setShowEventModal(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Event
              </button>
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="grid grid-cols-4 gap-6">
            <div className="col-span-3">
              <CalendarView onDateClick={handleDateClick} onEventClick={handleEventClick} />
            </div>

            <div className="col-span-1 space-y-4">
              <DailyMotivation />

              <div className="bg-white rounded-xl p-5 border border-[#E8E6DC] shadow-sm">
                <h3 className="font-heading font-semibold text-base text-[#141413] mb-3">{format(day, 'EEE, MMM d')}</h3>
                <div className="space-y-2">
                  {dayAgenda.taskSteps.length === 0 && dayAgenda.events.length === 0 ? (
                    <p className="text-sm text-[#B0AEA5]">No scheduled tasks or events.</p>
                  ) : (
                    <>
                      {dayAgenda.taskSteps.map(({ task, microTask }) => (
                        <div key={microTask.id} className="p-3 rounded-lg border border-[#E8E6DC] bg-[#FAF9F5]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs text-[#B0AEA5] font-heading">
                                {microTask.scheduledStart ? format(microTask.scheduledStart, 'h:mm a') : 'Planned'}
                              </p>
                              <p className="text-sm font-heading font-semibold text-[#141413] truncate">{microTask.title}</p>
                              <p className="text-xs text-[#B0AEA5] truncate">{task.title}</p>
                            </div>
                            <Link
                              href={`/focus?task=${task.id}&micro=${microTask.id}`}
                              className="px-3 py-2 text-xs font-heading font-semibold bg-[#141413] text-white rounded-lg hover:bg-[#2a2a28]"
                            >
                              Focus
                            </Link>
                          </div>
                        </div>
                      ))}

                      {dayAgenda.events.map((e) => (
                        <div key={e.id} className="p-3 rounded-lg border border-[#E8E6DC] bg-white">
                          <p className="text-xs text-[#B0AEA5] font-heading">
                            {e.allDay ? 'All day' : `${format(e.start, 'h:mm a')} - ${format(e.end, 'h:mm a')}`}
                          </p>
                          <p className="text-sm font-heading font-semibold text-[#141413]">{e.title}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {showEventModal && (
        <CalendarEventModal
          key={`${selectedEvent?.id || 'new'}-${selectedDate?.toISOString() || 'none'}`}
          isOpen={showEventModal}
          onClose={() => {
            setShowEventModal(false);
            setSelectedEvent(undefined);
          }}
          selectedDate={selectedDate}
          event={selectedEvent}
          onDelete={selectedEvent ? () => handleDelete() : undefined}
        />
      )}
    </div>
  );
}

