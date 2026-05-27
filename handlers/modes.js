const api = require('../services/api');

const LABELS = ['A', 'B', 'C', 'D'];
const SITE_LINK = 'https://ofijan.com';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function extractQuestion(item) {
  const q = item.question || item;
  return {
    id: q.id,
    question_text: q.question_text,
    explanation: q.explanation,
    options: shuffle(q.options || []),
  };
}

async function handleStudyMode(ctx) {
  try {
    if (await isLimitReached(ctx)) return;

    ctx.session.mode = 'study';
    ctx.session.questionIndex = 0;
    ctx.session.studyAnswers = {};

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
    ctx.session.testAnswers = {};

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

function formatTime(ms) {
  if (ms <= 0) return '⏱ 0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `⏱ ${min}:${String(sec).padStart(2, '0')}`;
}

async function loadQuestions(ctx) {
  const { examId } = ctx.session;

  const { data } = await api.get(`/exams/public/${examId}/questions`, {
    params: { mode: 'study' },
  });

  const apiData = data.data || data;
  const items = apiData.questions || [];

  if (!items.length) {
    await ctx.reply('❌ No questions found for this exam.');
    return false;
  }

  const timeLimitMin = apiData.exam?.total_time || 0;
  ctx.session.timeLimit = timeLimitMin > 0 ? timeLimitMin * 60 * 1000 : 0;
  ctx.session.startTime = timeLimitMin > 0 ? Date.now() : 0;

  ctx.session.questions = items.map(extractQuestion);
  ctx.session.totalQuestions = ctx.session.questions.length;
  return true;
}

async function sendQuestion(ctx) {
  const { questions, questionIndex, mode } = ctx.session;

  if (questionIndex >= questions.length || questionIndex < 0) return;

  const q = questions[questionIndex];
  const options = q.options || [];
  const prefix = mode === 'test' ? 'tans' : 'ans';
  const label = mode === 'test' ? '📝 Test' : '📖 Study';

  let timeStr = '';
  if (ctx.session.timeLimit && ctx.session.startTime) {
    const remaining = ctx.session.timeLimit - (Date.now() - ctx.session.startTime);
    timeStr = ' — ' + (remaining > 0 ? formatTime(remaining) : '⏱ Time up!');
  }
  const progress = `${label} — Question ${questionIndex + 1} / ${questions.length}${timeStr}`;

  const optionsText = options.map((opt, i) => `${LABELS[i]}. ${opt.option_text}`).join('\n');

  let answeredLabel = null;
  if (mode === 'study') {
    const a = ctx.session.studyAnswers || {};
    answeredLabel = a[questionIndex];
  } else {
    const ta = ctx.session.testAnswers || {};
    answeredLabel = ta[questionIndex] ? ta[questionIndex].selected_label : null;
  }
  const answeredText = answeredLabel ? `\n\n*Your answer:* ${answeredLabel}` : '';

  const optionRow = options.map((opt, i) => ({
    text: answeredLabel === LABELS[i] ? `✅ ${LABELS[i]}` : LABELS[i],
    callback_data: `${prefix}_${questionIndex}_${LABELS[i]}`,
  }));

  const navRow = [];
  if (questionIndex > 0) navRow.push({ text: '⬅️ Prev', callback_data: 'prev' });
  navRow.push({ text: `📄 ${questionIndex + 1}/${questions.length}`, callback_data: 'noop' });
  if (questionIndex < questions.length - 1) navRow.push({ text: 'Next ➡️', callback_data: 'next' });

  const keyboard = [optionRow, navRow];
  if (mode === 'test') {
    keyboard.push([
      { text: '🏁 Submit Test', callback_data: 'finish' },
      { text: '🚫 Cancel', callback_data: 'cancel_test' },
    ]);
  }

  await ctx.reply(`*${progress}*\n\n${q.question_text}\n\n${optionsText}${answeredText}`, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function showPremiumAd(ctx) {
  await ctx.reply(
    '⭐️ *Unlock Premium Features!*\n\n' +
    'Get unlimited access to:\n' +
    '✅ All questions & exams\n' +
    '✅ AI-powered explanations\n' +
    '✅ Priority support\n' +
    '✅ No ads\n\n' +
    'From just *1000 ETB / year*!',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '⭐️ View Premium Plans', callback_data: 'premium_ad' }],
          [{ text: 'Continue ➡️', callback_data: 'continue_ad' }],
        ],
      },
    }
  );
}

async function isLimitReached(ctx) {
  ctx.session.questionsAttempted = ctx.session.questionsAttempted || 0;
  if (ctx.session.questionsAttempted >= 100) {
    await ctx.editMessageText(
      '⚠️ *You have reached your free limit (100 questions).*\n\n[🌐 Go to ofijan.com for more](' + SITE_LINK + ')',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  return false;
}

module.exports = { handleStudyMode, handleTestMode, sendQuestion, showPremiumAd, LABELS, SITE_LINK, formatTime };
