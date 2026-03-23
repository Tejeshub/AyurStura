/**
 * AyurBot chat widget - quick questions and keyword-based responses.
 * Shown when user clicks Help Chat in dashboard. Receives open and onClose from parent.
 */
import { useState, useRef, useEffect } from 'react';
import { sendChatbotMessage } from '../services/api';
import './Chatbot.css';

const QUICK_QUESTIONS = [
  'How to book appointment?',
  'What is Ayurveda?',
  'Services offered?',
  'Contact information',
];

export default function Chatbot({ open, onClose }) {
  const [messages, setMessages] = useState([
    { id: 1, content: "Namaste! I'm AyurBot. Ask me anything about appointments, clinic support, or your dashboard flow.", isUser: false },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async (text) => {
    const t = (text || inputValue || '').trim();
    if (!t || typing) return;
    setInputValue('');
    const userId = Date.now();
    setMessages((prev) => [...prev, { id: userId, content: t, isUser: true }]);
    setTyping(true);
    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.content,
      }));
      const data = await sendChatbotMessage({ message: t, history });
      setMessages((prev) => [...prev, { id: Date.now() + 1, content: data.reply, isUser: false }]);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Chatbot unavailable right now. Please try again shortly.';
      setMessages((prev) => [...prev, { id: Date.now() + 1, content: msg, isUser: false }]);
    } finally {
      setTyping(false);
    }
  };

  if (!open) return null;

  return (
    <div className="chatbot-window">
      <div className="chat-header">
        <div className="chat-avatar">🤖</div>
        <div className="chat-info">
          <h4>AyurBot</h4>
          <span>Online</span>
        </div>
        <button type="button" className="chat-close" onClick={onClose} aria-label="Close">❌</button>
      </div>
      <div className="chat-messages" ref={messagesEndRef}>
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.isUser ? 'user-message' : 'bot-message'}`}>
            <div className="message-avatar">{m.isUser ? '👤' : '🤖'}</div>
            <div className="message-content">{m.content}</div>
          </div>
        ))}
        {typing && (
          <div className="message bot-message">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="quick-questions">
        <p>Quick questions:</p>
        <div className="question-buttons">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} type="button" onClick={() => send(q)}>{q}</button>
          ))}
        </div>
      </div>
      <div className="chat-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={typing}
        />
        <button type="button" onClick={() => send()} disabled={typing}>📤</button>
      </div>
    </div>
  );
}
