const { sendQuestion, showPremiumAd, LABELS, SITE_LINK, formatTime } = require('./modes');

function checkTimeExpired(ctx) {
  if (!ctx.session.timeLimit || !ctx.session.startTime) return false;
  return ctx.session.timeLimit - (Date.now() - ctx.session.startTime) <= 0;
}

async function handleTestAnswer(ctx) {
  if (checkTimeExpired(ctx)) {
    await ctx.answerCbQuery('⏰ Time is up!');
    return await showTestResults(ctx);
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

    if (!ctx.session.testAnswers) ctx.session.testAnswers = {};
    ctx.session.testAnswers[questionIdx] = {
      question_id: question.id,
      question_text: question.question_text,
      selected_label: selectedLabel,
      selected_text: selectedOption?.option_text || '',
      is_correct: isCorrect,
      correct_label: LABELS[options.findIndex((o) => o.is_correct)] || '?',
      correct_text: options.find((o) => o.is_correct)?.option_text || '',
      explanation: question.explanation || '',
    };

    ctx.session.questionsAttempted = (ctx.session.questionsAttempted || 0) + 1;

    const total = ctx.session.questions.length;
    const navRow = [];
    if (questionIdx > 0) navRow.push({ text: '⬅️ Prev', callback_data: 'prev' });
    if (questionIdx < total - 1) navRow.push({ text: 'Next ➡️', callback_data: 'next' });
    if (navRow.length === 0) {
      navRow.push({ text: '📊 See Results', callback_data: 'finish' });
    }

    await ctx.editMessageText(
      `✅ *Answer recorded* — Question ${questionIdx + 1} of ${total}`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [navRow] } }
    );
  } catch (err) {
    console.error('Test answer error:', err.message);
    await ctx.reply('❌ Error recording answer. Try /start again.');
  }
}

async function handlePrev(ctx) {
  if (checkTimeExpired(ctx)) { await ctx.answerCbQuery('⏰ Time is up!'); return await showTestResults(ctx); }
  await ctx.answerCbQuery();
  ctx.session.questionIndex -= 1;
  await sendQuestion(ctx);
}

async function handleNext(ctx) {
  if (checkTimeExpired(ctx)) { await ctx.answerCbQuery('⏰ Time is up!'); return await showTestResults(ctx); }
  await ctx.answerCbQuery();
  ctx.session.questionIndex += 1;

  const isPremium = ctx.session.user?.is_premium || false;
  if (
    !isPremium &&
    ctx.session.questionIndex % 2 === 0 &&
    ctx.session.questionIndex > 0 &&
    ctx.session.questionIndex < ctx.session.questions.length
  ) {
    await showPremiumAd(ctx);
    return;
  }

  await sendQuestion(ctx);
}

async function handleFinishTest(ctx) {
  if (checkTimeExpired(ctx)) { await ctx.answerCbQuery('⏰ Time is up!'); }
  try {
    await ctx.answerCbQuery();
    await showTestResults(ctx);
  } catch (err) {
    console.error('Finish test error:', err.message);
    await ctx.reply('❌ Error submitting test.');
  }
}

async function handleDone(ctx) {
  await ctx.answerCbQuery();
  const answers = ctx.session.studyAnswers || {};
  const questions = ctx.session.questions || [];
  let correct = 0;
  const wrongList = [];
  Object.keys(answers).forEach((idx) => {
    const q = questions[parseInt(idx)];
    if (!q) return;
    const opts = q.options || [];
    const correctIdx = opts.findIndex((o) => o.is_correct);
    const isRight = correctIdx >= 0 && LABELS[correctIdx] === answers[idx];
    if (isRight) { correct++; return; }
    wrongList.push({
      question_text: q.question_text,
      selected_label: answers[idx],
      selected_text: opts[LABELS.indexOf(answers[idx])]?.option_text || '',
      correct_label: LABELS[correctIdx] || '?',
      correct_text: opts[correctIdx]?.option_text || '',
      explanation: q.explanation || '',
    });
  });
  const total = Object.keys(answers).length;
  let msg = total > 0
    ? `✅ *You have completed this exam!*\n\n📊 Score: ${correct} / ${total} correct (${Math.round((correct / total) * 100)}%)\n`
    : '✅ Done!\n';
  if (wrongList.length > 0) {
    msg += '\n*Review wrong answers:*\n';
    wrongList.slice(0, 10).forEach((w) => {
      msg += `\n❌ ${w.question_text}\n`;
      msg += `   Your answer: ${w.selected_label}. ${w.selected_text}\n`;
      msg += `   Correct: ${w.correct_label}. ${w.correct_text}\n`;
    });
    if (wrongList.length > 10) msg += `\n_... and ${wrongList.length - 10} more_`;
  }
  msg += `\n[🌐 Go to ofijan.com for more](${SITE_LINK})`;
  ctx.session.mode = null;
  ctx.session.questions = [];
  ctx.session.studyAnswers = {};
  ctx.session.questionIndex = 0;
  await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
}

async function handleCancelTest(ctx) {
  try {
    await ctx.answerCbQuery();
    ctx.session.mode = null;
    ctx.session.testAnswers = {};
    ctx.session.questions = [];
    ctx.session.questionIndex = 0;
    await ctx.editMessageText('🚫 Test cancelled. Use /start to begin again.', { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Cancel test error:', err.message);
  }
}

async function showTestResults(ctx) {
  const answersMap = ctx.session.testAnswers || {};
  const answers = Object.values(answersMap).filter(Boolean);

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

  report += '\n\n[🌐 Go to ofijan.com for more](' + SITE_LINK + ')';

  await ctx.reply(report, { parse_mode: 'Markdown' });

  ctx.session.mode = null;
  ctx.session.testAnswers = {};
  ctx.session.questions = [];
  ctx.session.questionIndex = 0;
}

module.exports = handleTestAnswer;
module.exports.handlePrev = handlePrev;
module.exports.handleNext = handleNext;
module.exports.handleFinishTest = handleFinishTest;
module.exports.handleDone = handleDone;
module.exports.handleCancelTest = handleCancelTest;
