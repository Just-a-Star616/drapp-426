import React, { useState, useEffect, useRef } from 'react';
import { Message, MessageSender } from '../types';
import { sendMessage, subscribeToMessages, markConversationAsRead } from '../services/messaging';
import Button from './Button';

interface MessagingPanelProps {
  applicationId: string;
  currentUserId: string;
  currentUserName: string;
  userType: MessageSender;
  applicantName?: string;
}

const MessagingPanel: React.FC<MessagingPanelProps> = ({
  applicationId,
  currentUserId,
  currentUserName,
  userType,
  applicantName,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to messages
  useEffect(() => {
    const unsubscribe = subscribeToMessages(applicationId, (fetchedMessages) => {
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [applicationId]);

  // Mark messages as read when viewing
  useEffect(() => {
    const markAsRead = async () => {
      await markConversationAsRead(applicationId, userType);
    };

    // Mark as read when component mounts and when new messages arrive
    markAsRead();
  }, [applicationId, userType, messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(
        applicationId,
        currentUserId,
        currentUserName,
        userType,
        newMessage
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getOtherPartyName = () => {
    if (userType === MessageSender.Staff) {
      return applicantName || 'Applicant';
    }
    return 'Staff';
  };

  return (
    <div className="flex flex-col bg-slate-900 rounded-lg border border-sky-800" style={{ minHeight: '600px', maxHeight: '700px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-sky-800 bg-slate-800 shrink-0">
        <h3 className="text-lg font-semibold text-white">
          Direct Messages with {getOtherPartyName()}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Send and receive messages instantly. All messages are saved for your records.
        </p>
      </div>

      {/* Messages Container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ minHeight: '300px' }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-slate-400">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm">No messages yet</p>
              <p className="text-xs mt-1">Start a conversation below</p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.senderId === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-cyan-600 text-white'
                      : 'bg-slate-700 text-white'
                  }`}
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {message.senderName}
                    </span>
                    <span
                      className={`text-xs ${
                        isOwnMessage ? 'text-cyan-200' : 'text-slate-400'
                      }`}
                    >
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.message}
                  </p>
                  {isOwnMessage && (
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-cyan-200">
                        {message.isRead ? '✓✓ Read' : '✓ Sent'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-sky-800 bg-slate-800 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
            className="flex-1 px-4 py-3 rounded-lg bg-slate-700 text-white placeholder-slate-400 border-2 border-slate-600 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none"
            rows={3}
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isSending}
            className="px-6 py-3 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">
          {userType === MessageSender.Applicant
            ? 'Messages are visible to all staff members'
            : 'Messages are visible to the applicant'}
        </p>
      </div>
    </div>
  );
};

export default MessagingPanel;
