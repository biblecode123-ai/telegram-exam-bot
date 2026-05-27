const api = require('../services/api');
const axios = require('axios');

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
      `1. Transfer *${plan.price} ETB* to the following account:\n` +
      `   Bank: *Commercial Bank of Ethiopia*\n` +
      `   Account: *100029384756*\n` +
      `   Name: *Ofijan Educational Services*\n\n` +
      `2. After payment, send a photo of the receipt/transaction screenshot\n\n` +
      `➡️ *Send the payment screenshot here to continue*`;

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
    ctx.session.awaitingPaymentProof = false;
    return await ctx.reply('❌ Session expired. Use /plans to start again.');
  }

  await ctx.reply('📸 Got your screenshot! Now enter the *transaction ID/reference number*:', { parse_mode: 'Markdown' });
  ctx.session.awaitingTransactionId = true;
  ctx.session.paymentPhoto = ctx.message.photo;
}

async function handlePaymentTransaction(ctx, next) {
  if (!ctx.session.awaitingTransactionId || !ctx.message?.text) return next();

  const transactionId = ctx.message.text.trim();

  if (!ctx.session.authToken) {
    ctx.session.awaitingPaymentProof = false;
    ctx.session.awaitingTransactionId = false;
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
    form.append('transaction_id', transactionId);
    form.append('payment_method', 'telegram');
    form.append('screenshot', buffer, { filename: 'receipt.jpg', contentType: 'image/jpeg' });

    const { data: result } = await api.post('/payments/submit-proof', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${ctx.session.authToken}`,
      },
    });

    ctx.session.awaitingPaymentProof = false;
    ctx.session.awaitingTransactionId = false;
    ctx.session.paymentPhoto = null;
    ctx.session.pendingPlan = null;
    ctx.session.paymentPlanId = null;

    await ctx.reply(
      `✅ *Payment proof submitted!*\n\nYour request is pending review. An admin will verify and activate your premium access.\n\nUse /profile to check your status.`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('Payment submission error:', err.message);
    const errData = err.response?.data;
    let msg = '❌ Failed to submit payment. ';
    if (errData?.errors) {
      msg += Object.values(errData.errors).flat().join('\n');
    } else {
      msg += 'Try again or contact support.';
    }
    ctx.session.awaitingPaymentProof = false;
    ctx.session.awaitingTransactionId = false;
    await ctx.reply(msg);
  }
}

module.exports = { handlePlans, handleBuyPlan, handlePaymentPhoto, handlePaymentTransaction };
