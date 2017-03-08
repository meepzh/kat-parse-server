const passwordModule = require('password');

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('mturk-signup', function (req, res) {
  if (req.params && req.params.mid) {
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
  } else {
    res.error(406, 'Not Acceptable');
  }
});

Parse.Cloud.afterSave('Session', function(req) {
  req.user.increment('totalTime', req.object.get('finishTime'));
  req.user.save();
});
