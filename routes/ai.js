const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}

router.post('/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const openai = createOpenAIClient();

    if (!openai) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is not configured on the server',
      });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant named Euphorium for a campus marketplace called CampusCrate. You should give brief, grok-like answers. You can recommend items to buy or sell, and help users with problems. You can also calculate if it is more economical to buy or rent items based on user requirements.' },
        { role: 'user', content: message },
      ],
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

module.exports = router;
