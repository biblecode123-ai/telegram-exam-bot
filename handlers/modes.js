const api = require('../services/api');

const LABELS = ['A', 'B', 'C', 'D'];

async function handleStudyMode(ctx) {
  try {
    if (await isLimitReached(ctx)) return;

    ctx.session.mode = 'study';
    ctx.session.questionIndex = 0;

    await ctx.answerCbQuery();
    await ctx.editMessageText('📖 *Study Mode started!*\n\n_Loading questions..._', {
      parse_mode: 'Markdown',
    });

    const loaded = await loadQuestions(ctx);
    if (loaded) await sendQuestion(ctx);
  } catch (err) {
    console.error('Study mode error:', err.message);
    await ctx.reply('❌ Failed to start study mode.');
  }
}

async function handleTestMode(ctx) {
  try {
    if (await isLimitReached(ctx)) return;

    ctx.session.mode = 'test';
    ctx.session.questionIndex = 0;
    ctx.session.testAnswers = [];

    await ctx.answerCbQuery();
    await ctx.editMessageText('📝 *Test Mode started!*\n\n_Loading questions..._', {
      parse_mode: 'Markdown',
    });

    const loaded = await loadQuestions(ctx);
    if (loaded) await sendQuestion(ctx);
  } catch (err) {
    console.error('Test mode error:', err.message);
    await ctx.reply('❌ Failed to start test mode.');
  }
}

async function loadQuestions(ctx) {
  const { examId } = ctx.session;

  const { data } = await api.get(`/exams/${examId}/questions`, {
    params: { include: 'questions' },
  });

  const examData = data.data || data;
  const questions = examData.questions || [];

  if (!questions.length) {
    await ctx.reply('❌ No questions found for this exam.');
    return false;
  }

  ctx.session.questions = questions;
  ctx.session.totalQuestions = questions.length;
  return true;
}

async function sendQuestion(ctx) {
  const { questions, questionIndex, mode } = ctx.session;

  if (questionIndex >= questions.length) {
    await ctx.reply('✅ You have completed this exam!');
    return;
  }

  const q = questions[questionIndex];
  const options = q.options || [];
  const prefix = mode === 'test' ? 'tans' : 'ans';
  const label = mode === 'test' ? '📝 Test' : '📖 Study';
  const progress = `${label} — Question ${questionIndex + 1} / ${questions.length}`;

  const keyboard = options.map((opt, i) => [
    { text: `${LABELS[i]}. ${opt.option_text}`, callback_data: `${prefix}_${questionIndex}_${LABELS[i]}` },
  ]);

  if (mode === 'test') {
    keyboard.push([{ text: '🏁 Finish Test', callback_data: 'finish' }]);
  }

  await ctx.reply(`*${progress}*\n\n${q.question_text}`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function isLimitReached(ctx) {
  ctx.session.questionsAttempted = ctx.session.questionsAttempted || 0;
  if (ctx.session.questionsAttempted >= 100) {
    await ctx.editMessageText(
      '⚠️ *You have reached your free limit (100 questions).*\n\nContinue on our website: https://yourwebsite.com',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  return false;
}

module.exports = { handleStudyMode, handleTestMode, sendQuestion, LABELS };
