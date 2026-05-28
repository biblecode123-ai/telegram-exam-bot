const { sendQuestion, LABELS } = require('./modes');

async function handleStudyAnswer(ctx) {
  if (!ctx.session.questions?.length) {
    await ctx.answerCbQuery('Session expired');
    return await ctx.reply('❌ This exam session has ended.', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '🔄 Start Again', callback_data: 'start' }]] },
    });
  }
  try {
    const parts = ctx.callbackQuery.data.split('_');
    const questionIdx = parseInt(parts[1]);
    const selectedLabel = parts[2];

    await ctx.answerCbQuery();

    const question = ctx.session.questions[questionIdx];
    const options = question.options || [];

    const selectedIdx = LABELS.indexOf(selectedLabel);
    const selectedOption = options[selectedIdx];

    const isCorrect = selectedOption && selectedOption.is_correct;
    const correctIdx = options.findIndex((o) => o.is_correct);
    const correctLabel = LABELS[correctIdx] || '?';
    const correctText = options[correctIdx]?.option_text || '';

    if (!ctx.session.studyAnswers) ctx.session.studyAnswers = {};
    ctx.session.studyAnswers[questionIdx] = selectedLabel;
    ctx.session.questionsAttempted = (ctx.session.questionsAttempted || 0) + 1;

    const icon = isCorrect ? '✅' : '❌';
    const feedback =
      `${icon} *${isCorrect ? 'Correct!' : 'Wrong!'}*\n\n` +
      `*Your answer:* ${selectedLabel}. ${selectedOption?.option_text || ''}\n` +
      `*Correct Answer:* ${correctLabel}. ${correctText}\n` +
      `*Explanation:* ${question.explanation || 'No explanation available.'}`;

    const total = ctx.session.questions.length;
    const navRow = [];
    if (questionIdx > 0) navRow.push({ text: '⬅️ Prev', callback_data: 'prev' });
    if (questionIdx < total - 1) navRow.push({ text: 'Next ➡️', callback_data: 'next' });
    if (navRow.length === 0) navRow.push({ text: '✅ Done', callback_data: 'done' });

    await ctx.editMessageText(feedback, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [navRow] },
    });
  } catch (err) {
    console.error('Study answer error:', err.message);
    await ctx.reply('❌ Error processing answer. Try /start again.');
  }
}

module.exports = handleStudyAnswer;
