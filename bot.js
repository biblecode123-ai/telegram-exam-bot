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
const { handleFinishTest, handlePrev, handleNext, handleDone, handleCancelTest } = require('./handlers/test');
const helpHandler = require('./handlers/help');
const { handleRegister, handleLogin, handleLogout, handleProfile, handleAuthInput } = require('./handlers/auth');
const { handlePlans, handleBuyPlan, handlePaymentPhoto, handlePaymentName, handlePaymentTransaction, handlePaymentRemark } = require('./handlers/plans');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.use(session({
  defaultSession: () => ({
    categoryId: null,
    examId: null,
    mode: null,
    examsPage: 1,
    questionPage: 1,
    totalQuestions: 0,
    timeLimit: 0,
    startTime: 0,
    testAnswers: {},
    studyAnswers: {},
    questionsAttempted: 0,
    authToken: null,
    user: null,
    regStep: null,
    regData: {},
    loginStep: null,
    loginData: {},
    awaitingPaymentProof: false,
    awaitingPaymentName: false,
    awaitingTransactionId: false,
    awaitingPaymentRemark: false,
    paymentPhoto: null,
    pendingPlan: null,
    paymentPlanId: null,
    paymentName: null,
    paymentTransactionId: null,
    redirectAfterAuth: null,
  }),
}));

bot.use(handleAuthInput);
bot.use(handlePaymentPhoto);
bot.use(handlePaymentName);
bot.use(handlePaymentTransaction);
bot.use(handlePaymentRemark);

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

bot.action('prev', handlePrev);
bot.action('next', handleNext);
bot.action('finish', handleFinishTest);
bot.action('done', handleDone);
bot.action('cancel_test', handleCancelTest);
bot.action('noop', (ctx) => ctx.answerCbQuery());
bot.action('premium_ad', async (ctx) => {
  await ctx.answerCbQuery();
  const { handlePlans } = require('./handlers/plans');
  await handlePlans(ctx);
});
bot.action('continue_ad', async (ctx) => {
  await ctx.answerCbQuery();
  const { sendQuestion } = require('./handlers/modes');
  await sendQuestion(ctx);
});
bot.action('login_retry', async (ctx) => {
  await ctx.answerCbQuery();
  const { handleLogin } = require('./handlers/auth');
  await handleLogin(ctx);
});
bot.action('reg_retry', async (ctx) => {
  await ctx.answerCbQuery();
  const { handleRegister } = require('./handlers/auth');
  await handleRegister(ctx);
});
bot.action('auth_menu', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.session.regStep = null;
  ctx.session.regData = {};
  ctx.session.loginStep = null;
  ctx.session.loginData = {};
  const startHandler = require('./handlers/start');
  await startHandler(ctx);
});

bot.help(helpHandler);
bot.command('cancel', handleCancelTest);
bot.action('cmd_login', async (ctx) => {
  await ctx.answerCbQuery();
  const { handleLogin } = require('./handlers/auth');
  await handleLogin(ctx);
});
bot.action('cmd_register', async (ctx) => {
  await ctx.answerCbQuery();
  const { handleRegister } = require('./handlers/auth');
  await handleRegister(ctx);
});
bot.command('register', handleRegister);
bot.command('login', handleLogin);
bot.command('logout', handleLogout);
bot.command('profile', handleProfile);
bot.command('plans', handlePlans);
bot.action(/^buy_/, handleBuyPlan);

bot.catch((err) => {
  console.error('Bot error:', err);
});

const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('ofijan bot is running');
}).listen(PORT, () => console.log(`Health server on port ${PORT}`));

bot.launch();
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
