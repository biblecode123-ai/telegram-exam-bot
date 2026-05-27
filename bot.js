require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const startHandler = require('./handlers/start');
const {
  handleCategorySelect,
  handleExamsPage,
  handleExamSelect,
  handleBackToCategories,
  handleBackToExams,
} = require('./handlers/exams');
const { handleStudyMode, handleTestMode } = require('./handlers/modes');
const handleStudyAnswer = require('./handlers/study');
const handleTestAnswer = require('./handlers/test');
const { handleFinishTest, handleNext, handleDone, handleCancelTest } = require('./handlers/test');
const helpHandler = require('./handlers/help');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session({
  defaultSession: () => ({
    categoryId: null,
    examId: null,
    mode: null,
    examsPage: 1,
    questionPage: 1,
    totalQuestions: 0,
    testAnswers: [],
    questionsAttempted: 0,
  }),
}));

bot.start(startHandler);

bot.action(/^cat_/, handleCategorySelect);
bot.action(/^epage_/, handleExamsPage);
bot.action(/^exam_/, handleExamSelect);
bot.action('back_cat', handleBackToCategories);
bot.action('back_exam', handleBackToExams);

bot.action('mode_study', handleStudyMode);
bot.action('mode_test', handleTestMode);

bot.action(/^ans_/, handleStudyAnswer);
bot.action(/^tans_/, handleTestAnswer);

bot.action('next', handleNext);
bot.action('finish', handleFinishTest);
bot.action('done', handleDone);
bot.action('cancel_test', handleCancelTest);
bot.action('noop', (ctx) => ctx.answerCbQuery());

bot.help(helpHandler);
bot.command('cancel', handleCancelTest);

bot.catch((err) => {
  console.error('Bot error:', err);
});

bot.launch();
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
