const api = require('../services/api');

async function handleRegister(ctx) {
  ctx.session.regStep = 'awaiting_name';
  ctx.session.regData = {};
  await ctx.reply('📝 *Registration*\n\nPlease enter your full name:', { parse_mode: 'Markdown' });
}

async function handleLogin(ctx) {
  ctx.session.loginStep = 'awaiting_email';
  ctx.session.loginData = {};
  await ctx.reply('🔑 *Login*\n\nPlease enter your email:', { parse_mode: 'Markdown' });
}

async function handleLogout(ctx) {
  ctx.session.authToken = null;
  ctx.session.user = null;
  ctx.session.regStep = null;
  ctx.session.regData = {};
  ctx.session.loginStep = null;
  ctx.session.loginData = {};
  await ctx.reply('✅ Logged out successfully.');
}

async function handleProfile(ctx) {
  const user = ctx.session.user;
  if (!user) {
    return await ctx.reply('❌ You are not logged in. Use /login or /register.', { parse_mode: 'Markdown' });
  }
  await ctx.reply(
    `👤 *Your Profile*\n\nName: ${user.name}\nEmail: ${user.email}\nRole: ${user.role || 'Student'}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAuthInput(ctx, next) {
  if (!ctx.message || !ctx.message.text) return next();
  const text = ctx.message.text.trim();

  // Registration flow
  if (ctx.session.regStep) {
    switch (ctx.session.regStep) {
      case 'awaiting_name':
        if (text.length < 2) return await ctx.reply('Name must be at least 2 characters. Try again:');
        ctx.session.regData.name = text;
        ctx.session.regStep = 'awaiting_email';
        return await ctx.reply('Great! Now enter your email:');
      case 'awaiting_email':
        if (!text.includes('@')) return await ctx.reply('Please enter a valid email address:');
        ctx.session.regData.email = text.toLowerCase();
        ctx.session.regStep = 'awaiting_password';
        return await ctx.reply('Choose a password (min 8 chars, must include uppercase, lowercase, number, and special char):');
      case 'awaiting_password':
        if (text.length < 8) return await ctx.reply('Password must be at least 8 characters. Try again:');
        ctx.session.regData.password = text;
        ctx.session.regStep = 'awaiting_password_confirmation';
        return await ctx.reply('Confirm your password:');
      case 'awaiting_password_confirmation': {
        if (text !== ctx.session.regData.password) {
          return await ctx.reply('Passwords do not match. Try again:');
        }
        ctx.session.regData.password_confirmation = text;
        try {
          const { data } = await api.post('/register', {
            ...ctx.session.regData,
            telegram_username: ctx.from.username || null,
            telegram_chat_id: String(ctx.chat.id),
          });
          ctx.session.authToken = data.token;
          ctx.session.user = data.user;
          ctx.session.regStep = null;
          ctx.session.regData = {};
          const regMsg = ctx.session.redirectAfterAuth === 'plans'
            ? `✅ *Registration successful!*\n\nWelcome, ${data.user.name || data.user.email}!`
            : `✅ *Registration successful!*\n\nWelcome, ${data.user.name || data.user.email}! Use /start to begin practicing.`;
          await ctx.reply(regMsg, { parse_mode: 'Markdown' });
          if (ctx.session.redirectAfterAuth === 'plans') {
            ctx.session.redirectAfterAuth = null;
            const { handlePlans } = require('./plans');
            return await handlePlans(ctx);
          }
        } catch (err) {
          const errData = err.response?.data;
          ctx.session.regStep = null;
          ctx.session.regData = {};
          let msg = errData?.message || 'Registration failed. Try /register again.';
          if (errData?.errors) {
            const details = Object.values(errData.errors).flat().join('\n');
            msg += '\n' + details;
          }
          await ctx.reply('❌ ' + msg);
        }
        return;
      }
    }
    return;
  }

  // Login flow
  if (ctx.session.loginStep) {
    switch (ctx.session.loginStep) {
      case 'awaiting_email':
        if (!text.includes('@')) return await ctx.reply('Please enter a valid email:');
        ctx.session.loginData.email = text.toLowerCase();
        ctx.session.loginStep = 'awaiting_password';
        return await ctx.reply('Enter your password:');
      case 'awaiting_password': {
        ctx.session.loginData.password = text;
        try {
          const { data } = await api.post('/login', ctx.session.loginData);
          ctx.session.authToken = data.token;
          ctx.session.user = data.user;
          ctx.session.loginStep = null;
          ctx.session.loginData = {};
          const loginMsg = ctx.session.redirectAfterAuth === 'plans'
            ? `✅ *Welcome back, ${data.user.name || data.user.email}!*`
            : `✅ *Welcome back, ${data.user.name || data.user.email}!*\n\nUse /start to begin practicing.`;
          await ctx.reply(loginMsg, { parse_mode: 'Markdown' });
          if (ctx.session.redirectAfterAuth === 'plans') {
            ctx.session.redirectAfterAuth = null;
            const { handlePlans } = require('./plans');
            return await handlePlans(ctx);
          }
        } catch (err) {
          const errData = err.response?.data;
          ctx.session.loginStep = null;
          ctx.session.loginData = {};
          const msg = errData?.message || 'Login failed. Check your credentials and try /login again.';
          await ctx.reply('❌ ' + msg);
        }
        return;
      }
    }
    return;
  }

  return next();
}

module.exports = { handleRegister, handleLogin, handleLogout, handleProfile, handleAuthInput };
