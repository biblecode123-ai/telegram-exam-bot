const api = require('../services/api');
const axios = require('axios');

function clearPaymentSession(ctx) {
  ctx.session.awaitingPaymentProof = false;
  ctx.session.awaitingPaymentName = false;
  ctx.session.awaitingTransactionId = false;
  ctx.session.awaitingPaymentRemark = false;
  ctx.session.paymentPhoto = null;
  ctx.session.pendingPlan = null;
  ctx.session.paymentPlanId = null;
  ctx.session.paymentName = null;
  ctx.session.paymentTransactionId = null;
}

async function handlePlans(ctx) {
  try {
    const { data } = await api.get('/plans');
    const plans = data.data || [];

    if (!plans.length) {
      return await ctx.reply('No plans available at the moment.');
    }

    let msg = '*📋 Available Plans*\n\n';

    plans.forEach((p) => {
      const features = typeof p.features === 'string' ? JSON.parse(p.features) : p.features;
      msg += `*${p.name}* — ${p.price} ${p.currency} / ${p.duration_days} days\n`;
      msg += `${p.description || ''}\n`;
      if (Array.isArray(features) && features.length > 0) {
        features.forEach((f) => { msg += `✅ ${f}\n`; });
      } else if (typeof features === 'object' && features !== null) {
        Object.entries(features).forEach(([key, val]) => {
          if (val === true) msg += `✅ ${key.replace(/_/g, ' ')}\n`;
          else if (val === false) msg += `❌ ${key.replace(/_/g, ' ')}\n`;
          else if (typeof val === 'number') msg += `📊 ${key.replace(/_/g, ' ')}: ${val}\n`;
        });
      }
      msg += '\n';
    });

    if (ctx.session.user) {
      msg += 'Select a plan below to start payment:';
      const buttons = plans
        .filter((p) => p.price > 0)
        .map((p) => [{ text: `💎 ${p.name} — ${p.price} ${p.currency}`, callback_data: `buy_${p.id}` }]);
      return await ctx.reply(msg, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
    }

    msg += '❗ *You need to login first.*\nUse /login or /register to create an account.';
    ctx.session.redirectAfterAuth = 'plans';
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Plans error:', err.message);
    await ctx.reply('❌ Failed to load plans. Try again later.');
  }
}

async function handleBuyPlan(ctx) {
  const planId = parseInt(ctx.callbackQuery.data.split('_')[1]);
  await ctx.answerCbQuery();

  if (!ctx.session.user || !ctx.session.authToken) {
    return await ctx.editMessageText('❌ You need to login first.\nUse /login or /register.', { parse_mode: 'Markdown' });
  }

  try {
    const { data } = await api.get('/plans');
    const plans = data.data || [];
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return await ctx.editMessageText('❌ Plan not found.');

    ctx.session.pendingPlan = plan;

    const msg =
      `💎 *${plan.name} Plan — ${plan.price} ${plan.currency}*\n\n` +
      `📌 *Payment Instructions:*\n\n` +
      `1. Transfer *${plan.price} ETB* to **one** of the following:\n\n` +
      `   🏦 *Bank Account (CBE)*\n` +
      `   Account: *1000180359064*\n` +
      `   Name: *Kebede Guta*\n\n` +
      `   📱 *Tele Birr*\n` +
      `   Number: *0905180028*\n` +
      `   Name: *Million Sime*\n\n` +
      `2. After payment, take a screenshot of the receipt\n\n` +
      `3. Upload the photo **here in this chat** (use 📎 Attach → Photo)\n\n` +
      `➡️ *Send the payment screenshot now to continue*`;

    await ctx.editMessageText(msg, { parse_mode: 'Markdown' });
    ctx.session.awaitingPaymentProof = true;
    ctx.session.paymentPlanId = planId;
  } catch (err) {
    console.error('Buy plan error:', err.message);
    await ctx.editMessageText('❌ Failed to process. Try again.');
  }
}

async function handlePaymentPhoto(ctx, next) {
  if (!ctx.session.awaitingPaymentProof || !ctx.message?.photo) return next();

  const planId = ctx.session.paymentPlanId;
  const plan = ctx.session.pendingPlan;
  if (!planId || !plan) {
    clearPaymentSession(ctx);
    return await ctx.reply('❌ Session expired. Use /plans to start again.');
  }

  ctx.session.paymentPhoto = ctx.message.photo;
  ctx.session.awaitingPaymentProof = false;
  ctx.session.awaitingPaymentName = true;

  await ctx.reply('📸 Got your screenshot!\n\nPlease enter your *full name*:', { parse_mode: 'Markdown' });
}

async function handlePaymentName(ctx, next) {
  if (!ctx.session.awaitingPaymentName || !ctx.message?.text) return next();

  ctx.session.paymentName = ctx.message.text.trim();
  ctx.session.awaitingPaymentName = false;
  ctx.session.awaitingTransactionId = true;

  await ctx.reply('✅ Thank you, *' + ctx.session.paymentName + '*!\n\nNow enter the *transaction ID/reference number*:', { parse_mode: 'Markdown' });
}

async function handlePaymentTransaction(ctx, next) {
  if (!ctx.session.awaitingTransactionId || !ctx.message?.text) return next();

  ctx.session.paymentTransactionId = ctx.message.text.trim();
  ctx.session.awaitingTransactionId = false;
  ctx.session.awaitingPaymentRemark = true;

  await ctx.reply('✅ Got it!\n\nAny *remark or note*? (or send /skip to finish)', { parse_mode: 'Markdown' });
}

async function handlePaymentRemark(ctx, next) {
  if (!ctx.session.awaitingPaymentRemark || !ctx.message?.text) return next();

  const remark = ctx.message.text.trim() === '/skip' ? '' : ctx.message.text.trim();

  if (!ctx.session.authToken) {
    clearPaymentSession(ctx);
    return await ctx.reply('❌ You are not logged in. Use /login first.');
  }

  await ctx.reply('⏳ Submitting your payment proof...');

  try {
    const photo = ctx.session.paymentPhoto;
    const fileId = photo[photo.length - 1].file_id;
    const link = await ctx.telegram.getFileLink(fileId);
    const imgRes = await axios.get(link.href, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imgRes.data);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('plan_id', String(ctx.session.paymentPlanId));
    form.append('amount', String(ctx.session.pendingPlan.price));
    form.append('transaction_id', ctx.session.paymentTransactionId);
    form.append('payment_method', 'telegram');
    form.append('screenshot', buffer, { filename: 'receipt.jpg', contentType: 'image/jpeg' });
    form.append('student_name', ctx.session.paymentName);
    if (remark) form.append('remark', remark);

    await api.post('/payments/submit-proof', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${ctx.session.authToken}`,
      },
    });

    const inExam = ctx.session.mode && ctx.session.questions?.length > 0;
    clearPaymentSession(ctx);

    const successMsg =
      `✅ *Payment proof submitted!*\n\nYour request is pending review. An admin will verify and activate your premium access.\n\nUse /profile to check your status.`;
    const btns = inExam
      ? { reply_markup: { inline_keyboard: [[{ text: '📚 Continue Exam', callback_data: 'continue_ad' }]] } }
      : {};
    await ctx.reply(successMsg, { parse_mode: 'Markdown', ...btns });
  } catch (err) {
    console.error('Payment submission error:', err.message);
    const errData = err.response?.data;
    let msg = '❌ Failed to submit payment. ';
    if (errData?.errors) {
      msg += Object.values(errData.errors).flat().join('\n');
    } else {
      msg += 'Try again or contact support.';
    }
    clearPaymentSession(ctx);
    await ctx.reply(msg);
  }
}

module.exports = { handlePlans, handleBuyPlan, handlePaymentPhoto, handlePaymentName, handlePaymentTransaction, handlePaymentRemark };
