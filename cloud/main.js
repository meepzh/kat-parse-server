const passwordModule = require('password');

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('mturk-signup', function(req, res) {
  if (!(req.params && req.params.mid)) {
    res.error(406, 'Not Acceptable');
    return;
  }
  if (typeof req.params.mid !== 'string') {
    res.error(406, 'ID must be a character sequence');
    return;
  }
  if (req.params.mid.length < 6 || req.params.mid.length > 28) {
    res.error(406, 'Invalid ID length');
    return;
  }

  var user = new Parse.User();
  const password = passwordModule(4);
  user.set('username', req.params.mid);
  user.set('password', password);
  user.set('email', `tester-${req.params.mid}@nodomain.org`);
  user.set('mturkid', req.params.mid);
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
  if (!(req.params && req.params.mid)) {
    res.error(406, 'Not Acceptable');
  }
  if (typeof req.params.mid !== 'string') {
    res.error(406, 'ID must be a character sequence');
    return;
  }
  if (!(req.user)) {
    res.error(403, 'Forbidden: Not logged in');
    return;
  }
  if (req.user.mturkid !== req.params.mid) {
    res.error(403, 'Forbidden: Wrong username');
    return;
  }

  const password = passwordModule(4);
  req.user.set('password', password);
  req.user.save(null, {
    success: function(resultingUser) {
      res.success({'password': password});
    },
    error: function(resultingUser, error) {
      res.error(error.code, error.message);
    }
  });
});

Parse.Cloud.afterSave('Session', function(req) {
  req.user.increment('totalTime', req.object.get('finishTime'));
  req.user.save();
});
