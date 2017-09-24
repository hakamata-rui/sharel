'use strict'

const botkit = require('botkit');
const template = require('./Template');
const async = require('async');

// 環境変数が正しくセットされているかをチェック
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.PORT) {
  console.error('Specify CLIENT_ID CLIENT_SECRET and PORT in environment');
  process.exit(1);
}

// Botkitの設定
const controller = botkit.slackbot({
  json_file_store: './data/',
}).configureSlackApp(
  {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    scopes: ['bot', 'commands'],
  }
);

// OAuth、Interactive Messages、Slash Commandsのエンドポイント
controller.setupWebserver(process.env.PORT, (err, webserver) => {
  if (err) {
    console.error(`Setup webserver failed: ${err}`);
    process.exit(1);
  }
  // リクエスト元をSlackに絞り込む場合はVERIFICATION_TOKENを環境変数に設定すること
  controller.createWebhookEndpoints(webserver, process.env.VERIFICATION_TOKEN);
  controller.createOauthEndpoints(webserver, (err, req, res) => {
    if (err) {
      console.error(err);
      res.status(500).send(err);
      return;
    }
    res.send('Success');
  });
});

// SharelのみのBotに制限するために利用
let sharel;

// チームにAppがインストールされたらRTM APIをスタートする
controller.on('create_bot', (bot, config) => {
  if (sharel) {
    console.error('sharel already created.');
    return;
  }
  bot.startRTM((err) => {
    if (err) {
      controller.log.error(`failed to start sharel. ${err}`);
      return;
    }
    sharel = bot;
  });
});

// インストール済みのtokenの利用
controller.storage.teams.all((err, teams) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  if (sharel) {
    return
  }
  teams.filter((t) => t.bot).forEach((t) => {
    controller.spawn(t).startRTM((err, bot) => {
      if (err) {
        controller.log.error(`failed to start sharel. ${err}`);
        process.exit(1);
      }
      sharel = t.bot;
    });
  });
});

// Slash Commandsのイベントに対するアクション
// メニュー表示
controller.on('slash_command', (bot, message) => {
  bot.replyAcknowledge(() => {
    controller.storage.users.get(message.user, (err, actionUser) => {
      let user = actionUser;
      let reply = {};
      if (!user || !user.enable) {
        user = {
          id: message.user,
          enable: false,
          subscribe: [],
        };
        reply = template.hello();
      } else {
        reply = template.menu();
      }
      bot.reply(message, reply, (err) => {
        if (err) {
          controller.log.error(err);
          return;
        }
      });
      controller.storage.users.save(user);
    });
  });
});

// ボタンやプルダウンのイベントに対するアクション
// 登録・退会・フォロー設定・メニューを閉じる
controller.on('interactive_message_callback', (bot, message) => {
  const userId = message.user;
  controller.storage.users.get(userId, (err, user) => {
    if (err) {
      controller.log.error(err);
      return;
    }
    if (!user) {
      return;
    }
    switch (message.actions[0].name) {
      case 'signup': {
        signup(bot, message, user);
        break;
      }
      case 'subscribe': {
        subscribe(bot, message, user);
        break;
      }
      case 'withdrow': {
        withdrow(bot, message, user);
        break;
      }
      case 'close': {
        close(bot, message);
        break;
      }
      default: {
        break;
      }
    }
  });
});

// ダイレクトメッセージのイベントに対するアクション
// フォロワーへのメッセージ転送
controller.on('direct_message', (bot, message) => {
  const userId = message.user;
 
  controller.storage.users.get(userId, (err, publisher) => {
    if (err) {
      controller.log.error(err);
      return;
    }
    if (!publisher || !publisher.enable) {
      return;
    }
    // 投稿されたメッセージにチェックマークをつける
    bot.api.reactions.add(template.confirm(message), (err) => {
      if (err) {
        controller.log.error(err);
        return;
      }
    });
    publish(bot, message, publisher);
  });
});

// 登録する
function signup(bot, message, user) {
  user.enable = true;
  bot.api.chat.delete({ts: message.message_ts, channel: message.channel}, (err) => {
    if (err) {
      controller.log.error(err);
    }
  });
  bot.reply(message, template.signup(), (err) => {
    if (err) {
      controller.log.error(err);
    }
  });
  bot.api.users.info({user: message.user}, (err, info) => {
    if (err) {
      controller.log.error(err);
      return;
    }
    user.channel = message.channel;
    user.name = info.user.name;
    user.profile = info.user.profile;
    controller.storage.users.save(user, (err) => {
      if (err) {
        controller.log.error(err);
      }
    });
  });
}

// フォロー設定内容を投稿する
function postSubscribe(bot, message, subscriber) {
  controller.storage.users.all((err, subscribees) => {
    bot.replyInteractive(message, template.editSubscribe(subscriber, subscribees), (err) => {
      if (err) {
        controller.log.error(err);
      }
    });
  });
}

// フォロー設定する
function subscribe(bot, message, subscriber) {
  if (message.callback_id === 'edit-subscribe-menu') {
    const m = message.actions[0].selected_options[0].value.split('-');
    const method = m[0];
    const subscribee = m[1];
    const idx = subscriber.subscribe.indexOf(subscribee);
    const subscribed = idx >= 0;
    if (subscribed && method === 'unsubscribe') {
      subscriber.subscribe.splice(idx, 1);
    } else if (!subscribed && method === 'subscribe') {
      subscriber.subscribe.push(subscribee);
    }
    controller.storage.users.save(subscriber, (err) => {
      if (err) {
        controller.log.error(err);
        return;
      }
      postSubscribe(bot, message, subscriber);
    });
  } else {
    postSubscribe(bot, message, subscriber);
  }
}

// 退会する
function withdrow(bot, message, user) {
  user.enable = false;
  bot.api.chat.delete({ts: message.message_ts, channel: message.channel}, (err) => {
    if (err) {
      controller.log.error(err);
    }
  });
  bot.reply(message, template.withdrow(), (err) => {
    if (err) {
      controller.log.error(err);
    }
  });
  controller.storage.users.save(user);
}

// メニューボタンを閉じる
function close(bot, message) {
  bot.api.chat.delete({ts: message.message_ts, channel: message.channel}, (err) => {
    if (err) {
      controller.log.error(err);
    }
  });
}

// フォロワーにメッセージを転送する
function publish(bot, message, publisher) {
  controller.storage.users.all((err, subscribers) => {
    if (err) {
      controller.log.error(err);
      return;
    }
    async.each(subscribers, (subscriber, cb) => {
      if (!subscriber.subscribe) {
        return;
      }
      if (!subscriber.enable) {
        return;
      }
      const subscribed = subscriber.subscribe.indexOf(publisher.id) >= 0;
      if (!subscribed) {
        return;
      }
      // rate-limits対策
      // https://api.slack.com/docs/rate-limits
      setTimeout(() => {
          bot.api.chat.postMessage(template.publish(message, publisher, subscriber), (err) => {
            if (err) {
              controller.log.error(err);
            }
            cb();
          });
        }, 1000
      );
    }, (err) => {
      if (err) {
        controller.log.error(err);
      }
    });
  });
}