import React, { useState } from 'react';
import { Application } from '../types';
import Button from './Button';
import TextInput from './TextInput';
import { logActivity } from '../services/activityLog';
import { ActivityType, ActivityActor } from '../types';
import { auth } from '../services/firebase';

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  applications: Application[];
  selectedApplications?: Application[];
}

const SendNotificationModal: React.FC<SendNotificationModalProps> = ({
  isOpen,
  onClose,
  applications,
  selectedApplications = [],
}) => {
  const [recipients, setRecipients] = useState<string[]>(
    selectedApplications.map(app => app.id)
  );
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [selectMode, setSelectMode] = useState<'selected' | 'all' | 'custom'>('selected');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleToggleRecipient = (applicationId: string) => {
    setRecipients(prev =>
      prev.includes(applicationId)
        ? prev.filter(id => id !== applicationId)
        : [...prev, applicationId]
    );
  };

  const handleSelectAll = () => {
    setRecipients(applications.map(app => app.id));
    setSelectMode('all');
  };

  const handleDeselectAll = () => {
    setRecipients([]);
    setSelectMode('custom');
  };

  const handleSendNotification = async () => {
    setError('');
    setSuccess('');

    if (!title.trim()) {
      setError('Please enter a notification title.');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a notification message.');
      return;
    }

    if (recipients.length === 0) {
      setError('Please select at least one recipient.');
      return;
    }

    if (sendMode === 'schedule' && (!scheduleDate || !scheduleTime)) {
      setError('Please select a date and time for scheduled notification.');
      return;
    }

    setIsLoading(true);

    try {
      let scheduledFor = null;
      if (sendMode === 'schedule') {
        scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).getTime();

        if (scheduledFor <= Date.now()) {
          setError('Scheduled time must be in the future.');
          setIsLoading(false);
          return;
        }
      }

      // Call Cloud Function to send notification
      const response = await fetch(
        'https://us-central1-drapp-426.cloudfunctions.net/sendCustomNotification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipients,
            title,
            message,
            scheduledFor,
            sendNow: sendMode === 'now',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      const result = await response.json();

      // Log notification activity for each recipient
      if (auth.currentUser) {
        const recipientApps = applications.filter(app => recipients.includes(app.id));

        for (const app of recipientApps) {
          await logActivity({
            applicationId: app.id,
            applicantName: `${app.firstName} ${app.lastName}`,
            applicantEmail: app.email,
            activityType: ActivityType.NotificationSent,
            actor: ActivityActor.Staff,
            actorId: auth.currentUser.uid,
            actorName: auth.currentUser.email || 'Admin Staff',
            details: sendMode === 'now'
              ? `Sent notification: "${title}"`
              : `Scheduled notification for ${new Date(scheduledFor!).toLocaleString()}: "${title}"`,
            metadata: {
              notificationTitle: title,
              notificationMessage: message,
              sendMode,
              ...(scheduledFor && { scheduledFor }), // Only include if scheduledFor has a value
            },
          });
        }
      }

      if (sendMode === 'now') {
        setSuccess(`Notification sent successfully to ${recipients.length} applicant(s)!`);
      } else {
        setSuccess(
          `Notification scheduled successfully for ${new Date(scheduledFor!).toLocaleString()}!`
        );
      }

      // Reset form after 2 seconds
      setTimeout(() => {
        setTitle('');
        setMessage('');
        setScheduleDate('');
        setScheduleTime('');
        setRecipients([]);
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error sending notification:', error);
      setError('Failed to send notification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-sky-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Send Notification</h2>
              <p className="text-slate-400 mt-1">Send a custom notification to applicants</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg">
              <p className="text-sm text-green-200">{success}</p>
            </div>
          )}

          {/* Send Mode Toggle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">Send Mode</label>
            <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg">
              <button
                onClick={() => setSendMode('now')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  sendMode === 'now'
                    ? 'bg-cyan-900/50 text-cyan-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Send Now
              </button>
              <button
                onClick={() => setSendMode('schedule')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  sendMode === 'schedule'
                    ? 'bg-cyan-900/50 text-cyan-300'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Schedule
              </button>
            </div>
          </div>

          {/* Schedule Date/Time */}
          {sendMode === 'schedule' && (
            <div className="mb-6 grid grid-cols-2 gap-4">
              <TextInput
                id="scheduleDate"
                label="Schedule Date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <TextInput
                id="scheduleTime"
                label="Schedule Time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          )}

          {/* Notification Content */}
          <div className="mb-6 space-y-4">
            <TextInput
              id="title"
              label="Notification Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Application Update"
              required
            />
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1">
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your notification message..."
                rows={4}
                className="block w-full rounded-md shadow-sm sm:text-sm bg-slate-800 text-white placeholder-slate-400 border-slate-600 focus:border-cyan-500 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Recipient Selection */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-slate-300">
                Recipients ({recipients.length} selected)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Recipient List */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 max-h-60 overflow-y-auto">
              {applications.map((app) => (
                <label
                  key={app.id}
                  className="flex items-center px-4 py-3 hover:bg-slate-700/30 cursor-pointer border-b border-slate-700 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={recipients.includes(app.id)}
                    onChange={() => handleToggleRecipient(app.id)}
                    className="rounded border-slate-600 text-cyan-600 focus:ring-cyan-500 mr-3"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {app.firstName} {app.lastName}
                    </div>
                    <div className="text-xs text-slate-400">{app.email}</div>
                  </div>
                  <div className="text-xs text-slate-400">{app.status}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              Cancel
            </button>
            <Button
              onClick={handleSendNotification}
              isLoading={isLoading}
            >
              {sendMode === 'now' ? 'Send Now' : 'Schedule Notification'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendNotificationModal;
