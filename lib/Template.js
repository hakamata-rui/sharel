'use strict'

// Sign up
module.exports.hello = function() {
  return {
    text: '初めまして！SharelはSlack上のtwitterのようなコミュニケーションツールです。',
    attachments: [{
      title: '登録しますか？',
      attachment_type: 'default',
      callback_id: 'signup',
      actions: [
        {
          name: 'signup',
          text: '登録',
          type: 'button',
          value: 'signup',
        },
        {
          name: 'close',
          text: '閉じる',
          type: 'button',
          value: 'close',
        },
      ],
    }],
  };
};

// Menu
module.exports.menu = function() {
  return {
    text: 'ご用件はなんでしょうか？',
    attachments: [{
      title: 'ボタンを押してください。',
      attachment_type: 'default',
      callback_id: 'menu',
      actions: [
        {
          name: 'subscribe',
          text: 'フォロー設定',
          type: 'button',
          value: 'subscribe',
        },
        {
          name: 'withdrow',
          text: '退会',
          type: 'button',
          value: 'withdrow',
          confirm: {
            text: '本当に良いですか?',
            ok_text: 'はい',
            dismiss_text: 'いいえ',
          },
        },
        {
          name: 'close',
          text: '閉じる',
          type: 'button',
          value: 'close',
        },
      ],
    }],
  };
};

// editSubscribe
module.exports.editSubscribe = function(subscriber, subscribees) {
  const options = [];
  subscribees.forEach((subscribee) => {
    if (!subscribee.enable) {
      return;
    }
    const subscribed = !subscriber.subscribe || subscriber.subscribe.indexOf(subscribee.id) >= 0;
    const method = ((subscribed) ? 'unsubscribe' : 'subscribe');
    const emoji = ((subscribed) ? ':white_check_mark:' : '');
    options.push({
      text: `${emoji}${subscribee.name}`,
      value: `${method}-${subscribee.id}`,
    });
  });
  return {
    text: 'フォロー設定',
    attachments: [{
      title: 'フォロー・アンフォローするユーザを指定してください。',
      attachment_type: 'default',
      callback_id: 'edit-subscribe-menu',
      actions: [
        {
          name: 'subscribe',
          text: 'フォロー',
          type: 'select',
          options: options,
        },
        {
          name: 'close',
          text: '閉じる',
          type: 'button',
          value: 'close',
        },
      ],
    }],
  };
};

// Signup
module.exports.signup = function() {
  return {
    text: 'Sharelにようこそ！',
  };
};

// withdrow
module.exports.withdrow = function() {
  return {
    text: 'お世話になりました！',
  };
};

module.exports.publish = function(message, publisher, subscriber) {
  return {
    text: message.text,
    channel: subscriber.channel,
    unfurl_links: true,
    attachments: [{
      fallback: `post Sharel by ${publisher.name}`,
      author_name: publisher.name,
      author_icon: publisher.profile.image_24,
      footer: 'Sharel Transferd message',
      ts: message.ts,
    }],
  };
};

module.exports.confirm = function(message) {
  return {
    channel: message.channel,
    name: 'white_check_mark',
    timestamp: message.ts,
  };
}