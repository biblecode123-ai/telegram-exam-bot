// Results display is handled inline in test.js via submitTest()
// This file is reserved for future expansion (e.g., leaderboard, analytics)

async function viewStats(ctx) {
  try {
    await ctx.reply(
      '📊 *Your Stats*\n\n' +
      'Feature coming soon! Check back later.',
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

module.exports = { viewStats };
