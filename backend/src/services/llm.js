const env = require('../config/env');
// Optional: drafts an agent reply with Claude when ANTHROPIC_API_KEY is configured.
exports.draftReply = async ticket => {
  if (!env.anthropicKey) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.llmModel, max_tokens: 400, messages: [{ role: 'user', content: `You are a polite support agent. Write a short reply (max 120 words) to this ticket. Reply in the same language/style as the customer.\n\nTitle: ${ticket.title}\nDescription: ${ticket.description}` }] })
    });
    const j = await r.json();
    return j.content?.[0]?.text || null;
  } catch { return null; }
};
