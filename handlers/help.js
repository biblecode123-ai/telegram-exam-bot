async function helpHandler(ctx) {
  const msg =
    '📚 *ofijan exam Practice Bot — Commands*\n\n' +
    '/start — Choose an exam category and begin\n' +
    '/cancel — Cancel current exam and return to start\n' +
    '/help — Show this message\n\n' +
    '*Modes:*\n' +
    '📖 *Study* — Answer with instant feedback (shows correct answer)\n' +
    '📝 *Test* — Answer all questions, see results at the end\n\n' +
    '*Tip:* Options are shuffled each time you start!';
  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

module.exports = helpHandler;
