const { sendQuestion, LABELS } = require('./modes');

async function handleTestAnswer(ctx) {
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

    ctx.session.testAnswers.push({
      question_id: question.id,
      question_text: question.question_text,
      selected_label: selectedLabel,
      selected_text: selectedOption?.option_text || '',
      is_correct: isCorrect,
      correct_label: LABELS[options.findIndex((o) => o.is_correct)] || '?',
      correct_text: options.find((o) => o.is_correct)?.option_text || '',
      explanation: question.explanation || '',
    });

    await ctx.editMessageText(
      `✅ *Answer recorded* — Question ${questionIdx + 1} of ${ctx.session.questions.length}`,
      { parse_mode: 'Markdown' }
    );

    ctx.session.questionsAttempted = (ctx.session.questionsAttempted || 0) + 1;

    ctx.session.questionIndex += 1;

    if (ctx.session.questionIndex >= ctx.session.questions.length) {
      await showTestResults(ctx);
    } else {
      await sendQuestion(ctx);
    }
  } catch (err) {
    console.error('Test answer error:', err.message);
    await ctx.reply('❌ Error recording answer. Try /start again.');
  }
}

async function handleFinishTest(ctx) {
  try {
    await ctx.answerCbQuery();
    await showTestResults(ctx);
  } catch (err) {
    console.error('Finish test error:', err.message);
    await ctx.reply('❌ Error submitting test.');
  }
}

async function handleCancelTest(ctx) {
  try {
    await ctx.answerCbQuery();
    ctx.session.mode = null;
    ctx.session.testAnswers = [];
    ctx.session.questions = [];
    ctx.session.questionIndex = 0;
    await ctx.editMessageText('🚫 Test cancelled. Use /start to begin again.', { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Cancel test error:', err.message);
  }
}

async function showTestResults(ctx) {
  const answers = ctx.session.testAnswers;

  if (answers.length === 0) {
    await ctx.reply('No answers to submit.');
    return;
  }

  const correct = answers.filter((a) => a.is_correct).length;
  const wrong = answers.filter((a) => !a.is_correct).length;
  const total = answers.length;
  const scorePct = Math.round((correct / total) * 100);

  let report =
    `📊 *Test Results*\n\n` +
    `✅ Correct: ${correct}\n` +
    `❌ Wrong: ${wrong}\n` +
    `📝 Total: ${total}\n` +
    `🎯 Score: *${scorePct}%*\n`;

  const wrongAnswers = answers.filter((a) => !a.is_correct);
  if (wrongAnswers.length > 0) {
    report += '\n*Review wrong answers:*\n';
    wrongAnswers.forEach((a) => {
      report += `\n❌ ${a.question_text}\n`;
      report += `   Your answer: ${a.selected_label}. ${a.selected_text}\n`;
      report += `   Correct: ${a.correct_label}. ${a.correct_text}\n`;
    });
  }

  report += '\n\nUse /start to try another exam.';

  await ctx.reply(report, { parse_mode: 'Markdown' });

  ctx.session.mode = null;
  ctx.session.testAnswers = [];
  ctx.session.questions = [];
  ctx.session.questionIndex = 0;
}

module.exports = handleTestAnswer;
module.exports.handleFinishTest = handleFinishTest;
module.exports.handleCancelTest = handleCancelTest;
