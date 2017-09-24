'use strict'

const Botkit = require('botkit');

if (!process.env.TOKEN) {
  console.error('Specify TOKEN in environment');
  process.exit(1);
}

const controller = Botkit.slackbot();

controller.spawn({
  token: process.env.TOKEN
}).startRTM(function(err) {
  if (err) {
    throw new Error(err);
  }
});

// hello、hiのメッセージに反応
controller.hears(['hello','hi'],['direct_message','direct_mention','mention'], (bot,message) => {
  bot.reply(message,"Hello.");
});

// リアクションに反応
controller.on('reaction_added' ,(bot,message) => {
  bot.api.reactions.add({
    channel: message.item.channel,
    name: 'white_check_mark',
    timestamp: message.item.ts,
  });
});
