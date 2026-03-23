import { generateChatbotReply } from '../services/chatbotService.js';

const userWindow = new Map();
const LIMIT_COUNT = parseInt(process.env.CHATBOT_DAILY_LIMIT || '60', 10);
const WINDOW_MS = 24 * 60 * 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = userWindow.get(userId);
  if (!entry || now - entry.start > WINDOW_MS) {
    userWindow.set(userId, { start: now, count: 1 });
    return { allowed: true, remaining: LIMIT_COUNT - 1 };
  }
  if (entry.count >= LIMIT_COUNT) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: LIMIT_COUNT - entry.count };
}

export async function chatMessage(req, res, next) {
  try {
    const message = String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    if (!message) return res.status(400).json({ error: 'message is required' });
    if (message.length > 1200) return res.status(400).json({ error: 'message too long (max 1200 chars)' });

    const limited = checkRateLimit(req.user.id);
    if (!limited.allowed) {
      return res.status(429).json({
        error: 'Daily chatbot quota reached. Please try again tomorrow.',
        used_fallback: true,
      });
    }

    const response = await generateChatbotReply({
      user: req.user,
      message,
      history,
    });
    if (response.used_fallback && response.debug_error) {
      console.warn('[chatbot] Gemini fallback:', response.debug_error);
    }
    res.json({
      reply: response.reply,
      source: response.source,
      used_fallback: response.used_fallback,
      remaining_today: limited.remaining,
      debug_error: process.env.NODE_ENV === 'development' ? response.debug_error || null : undefined,
    });
  } catch (err) {
    next(err);
  }
}
