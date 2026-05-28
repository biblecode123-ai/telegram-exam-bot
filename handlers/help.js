async function helpHandler(ctx) {
  const msg =
    '📚 *ofijan exam Practice Bot — Commands*\n\n' +
    '*/start* — Choose an exam category and begin\n' +
    '*/cancel* — Cancel current exam\n' +
    '*/register* — Create a new account\n' +
    '*/login* — Log into your account\n' +
    '*/logout* — Log out\n' +
    '*/profile* — View your profile\n' +
    '*/plans* — View premium plans and subscribe\n' +
    '*/help* — Show this message\n\n' +
    '*Modes:*\n' +
    '📖 *Study* — Answer with instant feedback (shows correct answer)\n' +
    '📝 *Test* — Answer all questions, see results at the end\n\n' +
    '*Tip:* Options are shuffled each time you start!';
  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Start Again', callback_data: 'start' }],
      ],
    },
  });
}

module.exports = helpHandler;
