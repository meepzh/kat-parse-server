const Mailgun = require('mailgun-es6');
const passwordGen = require('password');
const mailgun = new Mailgun({
  privateApi: process.env.MAILGUN_KEY,
  domainName: process.env.MAILGUN_DOMAIN
});

function masterUserPointerFromUID(req, res) {
  if (!req.master) {
    res.error(403, 'Forbidden');
    return;
  }

  const uid = req.params.uid;
  if (!req.params.uid) {
    res.error(400, 'Bad Request');
    return;
  }
  if (typeof uid !== 'string') {
    res.error(400, 'ID must be a character sequence');
    return;
  }

  return {
    __type: 'Pointer',
    className: '_User',
    objectId: uid
  };
}

Parse.Cloud.define('hello', (req, res) => {
  res.success('Hi');
});

Parse.Cloud.define('mturk-signup', (req, res) => {
  const mid = req.params.mid;

  if (!req.params.mid) {
    res.error(400, 'Bad Request');
    return;
  }
  if (typeof mid !== 'string') {
    res.error(400, 'ID must be a character sequence');
    return;
  }
  if (mid.length < 6 || mid.length > 28) {
    res.error(400, 'Invalid ID length');
    return;
  }

  const user = new Parse.User();
  const password = passwordGen(4);
  user.set('username', mid);
  user.set('password', password);
  user.set('email', `tester-${mid}@nodomain.org`);
  user.set('mturkid', mid);
  user.set('completed', false);

  user.signUp(null).then((result) => {
    res.success({'password': password});
  }, (result, error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('init-web-activity', (req, res) => {
  const user = req.user;

  if (!user) {
    res.error(403, 'Not logged in');
    return;
  }

  const token = user.getSessionToken();

  const WebActivity = Parse.Object.extend('WebActivity');
  console.log('Create new WebActivity');
  const webActivity = new WebActivity();
  webActivity.set('user', user);
  webActivity.setACL(new Parse.ACL(user));
  console.log('Set web activity data');
  webActivity.save(null, {sessionToken: token}).then((result) => {
    console.log('Web activity success!');
    res.success({id: result.id});
  }, (result, error) => {
    console.log('Web activity error');
    console.log(error);
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('mturk-reset', (req, res) => {
  const user = req.user;

  const mid = req.params.mid;
  if (!req.params.mid) {
    res.error(400, 'Bad Request');
    return;
  }
  if (typeof mid !== 'string') {
    res.error(400, 'ID must be a character sequence');
    return;
  }
  if (!user) {
    res.error(403, 'Not logged in');
    return;
  }
  if (user.get('username') !== mid) {
    res.error(403, 'Wrong username');
    return;
  }
  if (user.get('mturkid') !== mid) {
    res.error(403, 'Wrong ID');
    return;
  }

  console.log('Prepping mturk-reset');
  const token = user.getSessionToken();

  const password = passwordGen(4);
  console.log('Generated password');
  user.set('password', password);
  console.log('Set password');
  user.save(null, {sessionToken: token}).then((result) => {
    console.log('Set password success!');
    res.success({'password': password});
  }, (result, error) => {
    console.log('Set password error');
    console.log(error);
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('sum-total-time', (req, res) => {
  const userPointer = masterUserPointerFromUID(req, res);
  if (!userPointer) return;

  const query = new Parse.Query('Session');
  query.equalTo('player', userPointer);
  query.find({useMasterKey: true}).then((results) => {
    let sum = 0;
    for (let i = 0; i < results.length; ++i) {
      sum += results[i].get('finishTime');
    }
    res.success(sum);
  }, (error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('support-mail', (req, res) => {
  // Validate inputs
  const user = req.user;

  if (!user) {
    res.error(403, 'Not logged in');
    return;
  }
  if (!(user.get('email') && user.get('emailVerified'))) {
    res.error(403, 'Email must be verified');
    return;
  }

  const token = user.getSessionToken();

  if (!req.params.subject) {
    res.error(400, 'Subject cannot be empty.');
    return;
  }
  if (!req.params.message) {
    res.error(400, 'Message cannot be empty.');
    return;
  }
  if (!process.env.SUPPORT_EMAIL) {
    res.error(500, 'Internal Server Error');
    return;
  }

  const subject = req.params.subject.trim();
  const message = req.params.message.trim();

  if (message.length < Parse.Config.current().get('minSupportMessageLength')) {
    res.error(400, 'Message must be at least 20 characters long.');
    return;
  }

  const query = new Parse.Query('SupportMessage');
  query.equalTo('user', user);

  // Update config
  Parse.Config.get()
  .then(() => {
    return query.count({sessionToken: token});
  })

  .then((results) => {
    // Validate user messages
    if (results >= Parse.Config.current().get('maxSupportMessages')) {
      res.error(403, 'Exceeded maximum number of support messages');
      return;
    }
    return true;
  }, (error) => {
    // Query fail
    console.error('Query Support Messages', error);
    res.error(500, 'Internal Server Error');
  })

  .then(() => {
    // Send the email
    const mailgunPromise = new Parse.Promise();
    mailgun.sendEmail({
      to: process.env.SUPPORT_EMAIL,
      from: process.env.MAILGUN_FROM,
      subject: subject,
      text: message,
      'h:Reply-To': user.get('email')
    }).then((data) => {
      mailgunPromise.resolve();
    }, (error) => {
      mailgunPromise.reject(error);
    });

    // Send the copy
    if (req.params.copy) {
      mailgun.sendEmail({
        to: user.get('email'),
        from: process.env.MAILGUN_FROM,
        subject: subject,
        text: message
      });
    }

    return mailgunPromise;
  })

  .then(() => {
    // Email success, save message
    const SupportMessage = Parse.Object.extend('SupportMessage');
    const supportMessage = new SupportMessage();
    supportMessage.set('user', user);
    supportMessage.set('subject', subject);
    supportMessage.set('message', message);
    return supportMessage.save(null, {sessionToken: token});
  }, (error) => {
    // Email fail
    console.error('Mailgun Send', error);
    res.error(500, 'Internal Server Error');
  })

  .then(() => {
    // Save success
    res.success('OK');
  }, (result, error) => {
    // Save fail
    console.error('Support Message Save', error);
    res.error(500, 'Internal Server Error');
  });
});

Parse.Cloud.define('user-export', (req, res) => {
  const userPointer = masterUserPointerFromUID(req, res);
  if (!userPointer) return;

  const userQuery = new Parse.Query('_User');
  userQuery.equalTo('objectId', userPointer.objectId);
  const userPromise = userQuery.first({useMasterKey: true});

  const sessionsQuery = new Parse.Query('Session');
  sessionsQuery.equalTo('player', userPointer);
  const sessionsPromise = sessionsQuery.find({useMasterKey: true});

  Parse.Promise.when([userPromise, sessionsPromise]).then((results) => {
    res.success(results);
  }, (errors) => {
    res.error(errors);
  });
});

Parse.Cloud.afterSave('Session', (req, res) => {
  const user = req.user;
  const token = user.getSessionToken();

  user.increment('totalTime', req.object.get('finishTime'));
  user.save(null, {sessionToken: token}).then((result) => {
    res.success('OK');
  }, (result, error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.beforeSave(Parse.User, (req, res) => {
  const user = req.object;
  if (!user.get('email')) {
    res.error('Every user must have an email address.');
  } else {
    res.success('OK');
  }
});
