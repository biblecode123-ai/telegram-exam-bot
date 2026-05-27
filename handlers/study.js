const { sendQuestion, LABELS } = require('./modes');

async function handleStudyAnswer(ctx) {
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

    const icon = isCorrect ? '✅' : '❌';
    const status = isCorrect ? 'Correct!' : 'Wrong!';

    const feedback =
      `${icon} *${status}*\n\n` +
      `*Correct Answer:* ${correctLabel}. ${correctText}\n` +
      `*Explanation:* ${question.explanation || 'No explanation available.'}`;

    await ctx.editMessageText(feedback, { parse_mode: 'Markdown' });

    ctx.session.questionsAttempted = (ctx.session.questionsAttempted || 0) + 1;

    ctx.session.questionIndex += 1;
    await sendQuestion(ctx);
  } catch (err) {
    console.error('Study answer error:', err.message);
    await ctx.reply('❌ Error processing answer. Try /start again.');
  }
}

module.exports = handleStudyAnswer;
