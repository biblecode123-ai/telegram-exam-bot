const api = require('../services/api');

async function handleCategorySelect(ctx) {
  try {
    const id = parseInt(ctx.callbackQuery.data.split('_')[1]);
    ctx.session.categoryId = id;
    ctx.session.examId = null;
    ctx.session.mode = null;
    ctx.session.examsPage = 1;
    ctx.session.questionIndex = 0;
    ctx.session.questions = [];
    ctx.session.testAnswers = [];

    await ctx.answerCbQuery();
    await showExams(ctx);
  } catch (err) {
    console.error('Category select error:', err.message);
    await ctx.reply('❌ Failed to load exams.');
  }
}

async function showExams(ctx) {
  const { categoryId, examsPage } = ctx.session;

  const { data } = await api.get(`/exam-categories/${categoryId}/exams`, {
    params: { page: examsPage },
  });

  const exams = data.data || [];
  const pagination = data.pagination || {};
  const totalPages = pagination.total_pages || 1;

  const buttons = exams.map((e) => [
    { text: e.exam_title, callback_data: `exam_${e.id}` },
  ]);

  const nav = [];
  if (examsPage > 1) {
    nav.push({ text: '⬅️ Previous', callback_data: `epage_${examsPage - 1}` });
  }
  nav.push({ text: `📄 ${examsPage}/${totalPages}`, callback_data: 'noop' });
  if (examsPage < totalPages) {
    nav.push({ text: 'Next ➡️', callback_data: `epage_${examsPage + 1}` });
  }
  if (nav.length > 1) buttons.push(nav);

  buttons.push([{ text: '🔙 Back to Categories', callback_data: 'back_cat' }]);

  await ctx.editMessageText('📚 *Select an exam:*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleExamsPage(ctx) {
  ctx.session.examsPage = parseInt(ctx.callbackQuery.data.split('_')[1]);
  await ctx.answerCbQuery();
  await showExams(ctx);
}

async function handleExamSelect(ctx) {
  const id = parseInt(ctx.callbackQuery.data.split('_')[1]);
  ctx.session.examId = id;
  ctx.session.questionIndex = 0;
  ctx.session.questions = [];
  ctx.session.testAnswers = [];

  await ctx.answerCbQuery();
  await ctx.editMessageText(
    '🎯 *Select exam mode:*',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📖 Study Mode', callback_data: 'mode_study' },
            { text: '📝 Test Mode', callback_data: 'mode_test' },
          ],
          [{ text: '🔙 Back to Exams', callback_data: 'back_exam' }],
        ],
      },
    }
  );
}

async function handleBackToCategories(ctx) {
  ctx.session.categoryId = null;
  ctx.session.examId = null;
  ctx.session.mode = null;
  ctx.session.questions = [];
  ctx.session.testAnswers = [];
  ctx.session.questionIndex = 0;

  await ctx.answerCbQuery();

  const { data } = await api.get('/exam-categories');
  const categories = data.data || data;

  const buttons = categories.map((c) => [
    { text: c.name, callback_data: `cat_${c.id}` },
  ]);

  await ctx.editMessageText('🎓 *Select an exam category:*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleBackToExams(ctx) {
  ctx.session.examId = null;
  ctx.session.mode = null;
  ctx.session.questions = [];
  ctx.session.testAnswers = [];
  ctx.session.questionIndex = 0;
  ctx.session.examsPage = 1;

  await ctx.answerCbQuery();
  await showExams(ctx);
}

module.exports = {
  handleCategorySelect,
  handleExamsPage,
  handleExamSelect,
  handleBackToCategories,
  handleBackToExams,
};
