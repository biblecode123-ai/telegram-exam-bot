const api = require('../services/api');

async function startHandler(ctx) {
  try {
    ctx.session.categoryId = null;
    ctx.session.examId = null;
    ctx.session.mode = null;
    ctx.session.examsPage = 1;
    ctx.session.questionIndex = 0;
    ctx.session.questions = [];
    ctx.session.totalQuestions = 0;
    ctx.session.testAnswers = [];
    ctx.session.questionsAttempted = 0;

    const { data } = await api.get('/exam-categories');
    const categories = data.data || data;

    const buttons = categories.map((c) => [
      { text: c.name, callback_data: `cat_${c.id}` },
    ]);

    await ctx.reply(
      '🎓 Welcome to Exit Exam Practice Bot!\n\nSelect an exam category to begin:',
      { reply_markup: { inline_keyboard: buttons } }
    );
  } catch (err) {
    console.error('Start error:', err.message);
    await ctx.reply('❌ Failed to load categories. Please try again later.');
  }
}

module.exports = startHandler;
