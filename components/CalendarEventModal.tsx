'use client';

import { useState } from 'react';
import { X, Clock, MapPin, Repeat, Calendar as CalendarIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CalendarEvent } from '@/types';

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date;
  event?: CalendarEvent;
  onDelete?: () => void;
}

const EVENT_TYPES = [
  { value: 'class', label: 'Class', color: '#6A9BCC' },
  { value: 'task', label: 'Task', color: '#788C5D' },
  { value: 'event', label: 'Event', color: '#D97757' },
  { value: 'meeting', label: 'Meeting', color: '#141413' },
  { value: 'study', label: 'Study Session', color: '#788C5D' },
  { value: 'other', label: 'Other', color: '#B0AEA5' },
];

const REPEAT_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function CalendarEventModal({ isOpen, onClose, selectedDate, event, onDelete }: CalendarEventModalProps) {
  const { addCalendarEvent, updateCalendarEvent } = useStore();
  const now = new Date();
  const initialStart = event
    ? (event.start instanceof Date ? event.start : new Date(event.start))
    : (selectedDate ? selectedDate : now);
  const initialEnd = event
    ? (event.end instanceof Date ? event.end : new Date(event.end))
    : (selectedDate ? new Date(selectedDate.getTime() + 60 * 60 * 1000) : new Date(now.getTime() + 60 * 60 * 1000));
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    startDate: initialStart.toISOString().split('T')[0],
    startTime: initialStart.toTimeString().slice(0, 5),
    endDate: initialEnd.toISOString().split('T')[0],
    endTime: initialEnd.toTimeString().slice(0, 5),
    allDay: event?.allDay || false,
    eventType: (event?.eventType || 'class') as CalendarEvent['eventType'],
    location: event?.location || '',
    repeat: !!event?.repeat,
    repeatFrequency: (event?.repeat?.frequency || 'weekly') as 'daily' | 'weekly' | 'monthly' | 'yearly',
    repeatInterval: event?.repeat?.interval || 1,
    repeatEndDate: event?.repeat?.endDate ? new Date(event.repeat.endDate).toISOString().split('T')[0] : '',
    daysOfWeek: event?.repeat?.daysOfWeek || ([] as number[]),
  });

  if (!isOpen) return null;

  const selectedEventType = EVENT_TYPES.find(t => t.value === formData.eventType);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDateTime = new Date(`${formData.startDate}T${formData.allDay ? '00:00' : formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.allDay ? '23:59' : formData.endTime}`);

    const calendarEvent: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
      title: formData.title,
      description: formData.description || undefined,
      start: startDateTime,
      end: endDateTime,
      allDay: formData.allDay,
      eventType: formData.eventType,
      color: selectedEventType?.color || '#6A9BCC',
      location: formData.location || undefined,
      repeat: formData.repeat ? {
        frequency: formData.repeatFrequency,
        interval: formData.repeatInterval,
        endDate: formData.repeatEndDate ? new Date(formData.repeatEndDate) : undefined,
        daysOfWeek: formData.repeatFrequency === 'weekly' ? formData.daysOfWeek : undefined,
      } : undefined,
    };

    if (event) {
      updateCalendarEvent(event.id, calendarEvent);
    } else {
      addCalendarEvent(calendarEvent);
    }
    onClose();
  };

  const toggleDayOfWeek = (day: number) => {
    setFormData({
      ...formData,
      daysOfWeek: formData.daysOfWeek.includes(day)
        ? formData.daysOfWeek.filter(d => d !== day)
        : [...formData.daysOfWeek, day].sort(),
    });
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E8E6DC] px-6 py-4 flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-[#141413]">
            {event ? 'Edit Event' : 'Create Event'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#B0AEA5] hover:text-[#141413] hover:bg-[#FAF9F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-body"
              required
              autoFocus
              placeholder="e.g., Math Class, Study Session"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Event Type *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, eventType: type.value as CalendarEvent['eventType'] })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all font-heading font-medium text-sm ${
                    formData.eventType === type.value
                      ? 'border-[#141413] bg-[#141413] text-white'
                      : 'border-[#E8E6DC] bg-white text-[#141413] hover:border-[#6A9BCC]'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-body min-h-[100px]"
              placeholder="Add details about this event..."
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allDay}
                onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#E8E6DC] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#6A9BCC] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6A9BCC]"></div>
            </label>
            <span className="text-sm font-heading font-medium text-[#141413]">All Day</span>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                required
              />
            </div>
            {!formData.allDay && (
              <div>
                <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                required
              />
            </div>
            {!formData.allDay && (
              <div>
                <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                  required
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-body"
              placeholder="e.g., Room 201, Online, Library"
            />
          </div>

          {/* Repeat */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.repeat}
                  onChange={(e) => setFormData({ ...formData, repeat: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#E8E6DC] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#6A9BCC] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6A9BCC]"></div>
              </label>
              <span className="text-sm font-heading font-medium text-[#141413] flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Repeat Event
              </span>
            </div>

            {formData.repeat && (
              <div className="pl-14 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                      Frequency
                    </label>
                    <select
                      value={formData.repeatFrequency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          repeatFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly',
                        })
                      }
                      className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                    >
                      {REPEAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                      Every (interval)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.repeatInterval}
                      onChange={(e) => setFormData({ ...formData, repeatInterval: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                    />
                  </div>
                </div>

                {formData.repeatFrequency === 'weekly' && (
                  <div>
                    <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                      Days of Week
                    </label>
                    <div className="flex gap-2">
                      {dayLabels.map((label, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => toggleDayOfWeek(index)}
                          className={`px-3 py-2 rounded-lg border-2 transition-all font-heading font-medium text-sm ${
                            formData.daysOfWeek.includes(index)
                              ? 'border-[#141413] bg-[#141413] text-white'
                              : 'border-[#E8E6DC] bg-white text-[#141413] hover:border-[#6A9BCC]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-heading font-medium text-[#141413] mb-2">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={formData.repeatEndDate}
                    onChange={(e) => setFormData({ ...formData, repeatEndDate: e.target.value })}
                    className="w-full px-4 py-3 border border-[#E8E6DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A9BCC] focus:border-transparent font-heading"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8E6DC]">
            {event && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to delete this event?')) {
                    onDelete();
                    onClose();
                  }
                }}
                className="px-6 py-3 border border-[#D97757] text-[#D97757] rounded-lg font-heading font-medium hover:bg-[#D97757] hover:text-white transition-colors"
              >
                Delete Event
              </button>
            )}
            <div className={`flex items-center gap-3 ${event && onDelete ? 'ml-auto' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-[#E8E6DC] text-[#141413] rounded-lg font-heading font-medium hover:bg-[#FAF9F5] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-[#141413] text-white rounded-lg font-heading font-medium hover:bg-[#2a2a28] transition-colors"
              >
                {event ? 'Update Event' : 'Create Event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
