const passwordGen = require('password');

function constructUserPointer(req, res) {
  const isMaster = req.master;
  if (!isMaster) {
    res.error(403, 'Forbidden');
    return;
  }

  if (!(req.params && req.params.uid)) {
    res.error(400, 'Bad Request');
    return;
  }
  const uid = req.params.uid;
  if (typeof uid !== 'string') {
    res.error(400, 'ID must be a character sequence');
    return;
  }

  return {
    __type: 'Pointer',
    className: '_User',
    objectId: req.params.uid
  };
}

Parse.Cloud.define('hello', (req, res) => {
  res.success('Hi');
});

Parse.Cloud.define('mturk-signup', (req, res) => {
  if (!(req.params && req.params.mid)) {
    res.error(400, 'Bad Request');
    return;
  }

  const mid = req.params.mid;

  if (typeof mid !== 'string') {
    res.error(400, 'ID must be a character sequence');
    return;
  }
  if (mid.length < 6 || mid.length > 28) {
    res.error(400, 'Invalid ID length');
    return;
  }

  let user = new Parse.User();
  const password = passwordGen(4);
  user.set('username', mid);
  user.set('password', password);
  user.set('email', `tester-${mid}@nodomain.org`);
  user.set('mturkid', mid);
  user.set('completed', false);

  user.signUp(null).then((userResult) => {
    res.success({'password': password});
  }, (userResult, error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('init-web-activity', (req, res) => {
  let user = req.user;

  if (!user) {
    res.error(403, 'Forbidden: Not logged in');
    return;
  }

  const token = user.getSessionToken();

  let WebActivity = Parse.Object.extend('WebActivity');
  let webActivity = new WebActivity();
  webActivity.set('user', user);
  webActivity.setACL(new Parse.ACL(user));
  webActivity.save(null, {sessionToken: token}).then((webActivityResult) => {
    res.success({id: webActivityResult.id});
  }, (webActivityResult, error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('mturk-reset', (req, res) => {
  let user = req.user;

  if (!(req.params && req.params.mid)) {
    res.error(400, 'Bad Request');
    return;
  }

  const mid = req.params.mid;

  if (typeof mid !== 'string') {
    res.error(400, 'ID must be a character sequence');
    return;
  }
  if (!user) {
    res.error(403, 'Forbidden: Not logged in');
    return;
  }
  if (user.get('username') !== mid) {
    res.error(403, 'Forbidden: Wrong username');
    return;
  }
  if (user.get('mturkid') !== mid) {
    res.error(403, 'Forbidden: Wrong ID');
    return;
  }

  const token = user.getSessionToken();

  const password = passwordGen(4);
  user.set('password', password);
  user.save(null, {sessionToken: token}).then((userResult) => {
    res.success({'password': password});
  }, (userResult, error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.define('sum-total-time', (req, res) => {
  const userPointer = constructUserPointer(req, res);
  if (!userPointer) return;

  let query = new Parse.Query('Session');
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
  let user = req.user;

  if (!user) {
    res.error(403, 'Forbidden: Not logged in');
    return;
  }
  if (!(user.get('email') && user.get('emailVerified'))) {
    res.error(403, 'Forbidden: Email must be verified');
    return;
  }

  const token = user.getSessionToken();

  if (!(req.params.subject && req.params.message)) {
    res.error(400, 'Bad Request');
    return;
  }

  const subject = req.params.subject.trim();
  const message = req.params.message.trim();

  let errors = [];

});

Parse.Cloud.define('user-export', (req, res) => {
  const userPointer = constructUserPointer(req, res);
  if (!userPointer) return;

  let userQuery = new Parse.Query('_User');
  userQuery.equalTo('objectId', userPointer.objectId);
  let userPromise = userQuery.first({useMasterKey: true});

  let sessionsQuery = new Parse.Query('Session');
  sessionsQuery.equalTo('player', userPointer);
  let sessionsPromise = sessionsQuery.find({useMasterKey: true});

  Parse.Promise.when([userPromise, sessionsPromise]).then((results) => {
    res.success(results);
  }, (errors) => {
    res.error(errors);
  });
});

Parse.Cloud.afterSave('Session', (req, res) => {
  let user = req.user;
  const token = user.getSessionToken();

  user.increment('totalTime', req.object.get('finishTime'));
  user.save(null, {sessionToken: token}).then((userResult) => {
    res.success();
  }, (userResult, error) => {
    res.error(error.code, error.message);
  });
});

Parse.Cloud.beforeSave(Parse.User, (req, res) => {
  let user = req.object;
  if (!user.get('email')) {
    res.error('Every user must have an email address.');
  } else {
    res.success();
  }
});
