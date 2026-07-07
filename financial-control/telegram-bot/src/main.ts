import { Telegraf } from 'telegraf';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.log('TELEGRAM_BOT_TOKEN não configurado — bot em modo stub');
  process.exit(0);
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Bot do Sistema Financeiro iniciado. Em breve disponível!'));

bot.launch().then(() => {
  console.log('Telegram bot iniciado');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
