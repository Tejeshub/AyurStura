import { GoogleGenerativeAI } from '@google/generative-ai';
import { query } from '../config/db.js';

const MODEL_NAME = process.env.CHATBOT_MODEL || 'gemini-1.5-flash';
const MAX_PROMPT_CHARS = parseInt(process.env.CHATBOT_MAX_PROMPT_CHARS || '6000', 10);
const MAX_HISTORY_TURNS = parseInt(process.env.CHATBOT_MAX_HISTORY_TURNS || '6', 10);
const MAX_OUTPUT_TOKENS = parseInt(process.env.CHATBOT_MAX_OUTPUT_TOKENS || '220', 10);

const FAQ_FALLBACKS = [
  {
    re: /book|appointment|schedule/i,
    text: 'To book an appointment, open Book Appointment, select doctor and preferred date, then add your symptoms.',
  },
  {
    re: /reschedule|change date/i,
    text: 'For reschedule requests, check your appointments tab and confirm or reject proposed changes there.',
  },
  {
    re: /contact|phone|email|address/i,
    text: 'You can contact the clinic at admin@ayurvedaclinic.com or +91 98765 43210.',
  },
];

function asDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function makeFallbackReply(message) {
  const match = FAQ_FALLBACKS.find((f) => f.re.test(message || ''));
  return match
    ? `${match.text}\n\n(Using fallback support response right now.)`
    : "I'm facing high traffic right now. Please try again in a minute. You can still use dashboard tabs for bookings, appointments, and profile updates.";
}

async function getRoleContext(user) {
  if (user.role === 'patient') {
    const [appointments] = await query(
      `SELECT a.appointment_date, a.confirmed_date, a.confirmed_time, a.status, a.type, u.name AS doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE a.patient_id = ?
       ORDER BY a.created_at DESC
       LIMIT 5`,
      [user.id]
    );
    return {
      role: 'patient',
      recent_appointments: appointments.map((a) => ({
        doctor_name: a.doctor_name,
        type: a.type,
        status: a.status,
        appointment_date: asDateOnly(a.appointment_date),
        confirmed_date: asDateOnly(a.confirmed_date),
        confirmed_time: a.confirmed_time ? String(a.confirmed_time).slice(0, 5) : null,
      })),
    };
  }

  if (user.role === 'doctor') {
    const [doctorRows] = await query('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
    if (!doctorRows.length) return { role: 'doctor', warning: 'Doctor profile not found' };
    const doctorId = doctorRows[0].id;
    const [[stats]] = await query(
      `SELECT
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_count
       FROM appointments
       WHERE doctor_id = ?`,
      [doctorId]
    );
    const [unavailable] = await query(
      'SELECT unavailable_date FROM doctor_unavailable_days WHERE doctor_id = ? ORDER BY unavailable_date DESC LIMIT 5',
      [doctorId]
    );
    return {
      role: 'doctor',
      appointment_stats: {
        pending_count: Number(stats?.pending_count || 0),
        confirmed_count: Number(stats?.confirmed_count || 0),
      },
      recent_unavailable_days: unavailable.map((u) => asDateOnly(u.unavailable_date)),
    };
  }

  const [[totals]] = await query(
    `SELECT
       (SELECT COUNT(*) FROM doctors) AS doctors_count,
       (SELECT COUNT(*) FROM users WHERE role = 'patient') AS patients_count,
       (SELECT COUNT(*) FROM appointments WHERE status = 'pending') AS pending_appointments`
  );
  return {
    role: 'admin',
    clinic_totals: {
      doctors_count: Number(totals?.doctors_count || 0),
      patients_count: Number(totals?.patients_count || 0),
      pending_appointments: Number(totals?.pending_appointments || 0),
    },
  };
}

function buildPrompt({ user, message, history, context }) {
  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_TURNS)
    .map((h) => ({
      role: h?.role === 'assistant' ? 'assistant' : 'user',
      content: String(h?.content || '').slice(0, 500),
    }));

  const payload = {
    user: { role: user.role, name: user.name || user.email || 'User' },
    context,
    history: safeHistory,
    latest_user_message: String(message || '').slice(0, 1200),
  };

  const instruction = [
    'You are AyurBot, support assistant for an Ayurveda clinic web app.',
    'Follow strict rules:',
    '- Only provide support and app-operation guidance.',
    '- Do not provide medical diagnosis, emergency advice, or prescriptions.',
    '- If asked for clinical advice, suggest consulting a doctor.',
    '- Only use the given role context; never invent private data.',
    '- Keep answers concise and practical.',
  ].join('\n');

  const combined = `${instruction}\n\nINPUT_JSON:\n${JSON.stringify(payload, null, 2)}`;
  return combined.slice(0, MAX_PROMPT_CHARS);
}

export async function generateChatbotReply({ user, message, history = [] }) {
  const context = await getRoleContext(user);
  const prompt = buildPrompt({ user, message, history, context });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      reply: makeFallbackReply(message),
      source: 'fallback',
      used_fallback: true,
      debug_error: 'GEMINI_API_KEY missing',
    };
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.4,
      },
    });
    const reply = result?.response?.text?.()?.trim();
    if (!reply) {
      return {
        reply: makeFallbackReply(message),
        source: 'fallback',
        used_fallback: true,
        debug_error: 'Gemini returned empty response',
      };
    }
    return { reply, source: 'gemini', used_fallback: false, debug_error: null };
  } catch (err) {
    const debugError = err?.message || 'Unknown Gemini error';
    return {
      reply: makeFallbackReply(message),
      source: 'fallback',
      used_fallback: true,
      debug_error: debugError,
    };
  }
}
