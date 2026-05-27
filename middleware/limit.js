const api = require('../services/api');

async function checkLimit(ctx, next) {
  try {
    const { data } = await api.get('/student-progress', {
      params: { telegram_id: ctx.from.id },
    });

    ctx.session.questionsAttempted = data.questions_attempted || 0;

    if (ctx.session.questionsAttempted >= 100) {
      await ctx.reply(
        '⚠️ *You have reached your free limit (100 questions).*\n\nContinue on our website: https://yourwebsite.com',
        { parse_mode: 'Markdown' }
      );
      return;
    }
  } catch {
    if (!ctx.session.questionsAttempted) {
      ctx.session.questionsAttempted = 0;
    }
  }

  return next();
}

module.exports = checkLimit;
