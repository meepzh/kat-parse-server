const passwordModule = require('password');

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('mturk-signup', function(req, res) {
  if (!(req.params && req.params.mid)) {
    res.error(406, 'Not Acceptable');
    return;
  }

  const mid = req.params.mid;

  if (typeof mid !== 'string') {
    res.error(406, 'ID must be a character sequence');
    return;
  }
  if (mid.length < 6 || mid.length > 28) {
    res.error(406, 'Invalid ID length');
    return;
  }

  var user = new Parse.User();
  const password = passwordModule(4);
  user.set('username', mid);
  user.set('password', password);
  user.set('email', `tester-${mid}@nodomain.org`);
  user.set('mturkid', mid);
  user.set('completed', false);

  user.signUp(null, {
    success: function(resultingUser) {
      res.success({'password': password});
    },
    error: function(resultingUser, error) {
      res.error(error.code, error.message);
    }
  });
});

Parse.Cloud.define('mturk-reset', function(req, res) {
  var user = req.user;

  if (!(req.params && req.params.mid)) {
    res.error(406, 'Not Acceptable');
  }

  const mid = req.params.mid;

  if (typeof mid !== 'string') {
    res.error(406, 'ID must be a character sequence');
    return;
  }
  if (!(user)) {
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

  const password = passwordModule(4);
  user.set('password', password);
  user.save({sessionToken: token}, {
    success: function(resultingUser) {
      res.success({'password': password});
    },
    error: function(resultingUser, error) {
      res.error(error.code, error.message);
    }
  });
});

Parse.Cloud.afterSave('Session', function(req) {
  var user = req.user;
  const token = user.getSessionToken();

  user.increment('totalTime', req.object.get('finishTime'));
  user.save({sessionToken: token});
});
