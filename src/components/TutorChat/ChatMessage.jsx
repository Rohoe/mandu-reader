/**
 * Single chat message bubble — user or assistant styling.
 */

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`tutor-chat__message ${isUser ? 'tutor-chat__message--user' : 'tutor-chat__message--assistant'}`}>
      <div className="tutor-chat__message-content">
        {message.content}
      </div>
    </div>
  );
}
