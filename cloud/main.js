const passwordModule = require('password');

function constructUserPointer(req, res) {
  const isMaster = req.master;
  if (!isMaster) {
    res.error(403, 'Forbidden');
    return;
  }

  if (!(req.params && req.params.uid)) {
    res.error(406, 'Not Acceptable');
    return;
  }
  const uid = req.params.uid;
  if (typeof uid !== 'string') {
    res.error(406, 'ID must be a character sequence');
    return;
  }

  return {
    __type: 'Pointer',
    className: '_User',
    objectId: req.param.uid
  };
}

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

  let user = new Parse.User();
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
  let user = req.user;

  if (!(req.params && req.params.mid)) {
    res.error(406, 'Not Acceptable');
    return;
  }

  const mid = req.params.mid;

  if (typeof mid !== 'string') {
    res.error(406, 'ID must be a character sequence');
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

Parse.Cloud.define('sum-total-time', function(req, res) {
  const userPointer = constructUserPointer(req, res);
  if (!userPointer) return;

  let query = Parse.Query('Session');
  query.equalTo('player', userPointer);
  query.find({useMasterKey: true}, {
    success: function(results) {
      var sum = 0;
      for (var i = 0; i < results.length; ++i) {
        sum += results[i].get('finishTime');
      }
      res.success(sum);
    },
    error: function(error) {
      res.error(error.code, error.message);
    }
  });
});

Parse.Cloud.define('user-export', function(req, res) {
  const userPointer = constructUserPointer(req, res);
  if (!userPointer) return;

  let query = Parse.Query('Session');
  query.equalTo('player', userPointer);
  query.find({useMasterKey: true}, {
    success: function(results) {
      res.success(results);
    },
    error: function(error) {
      res.error(error.code, error.message);
    }
  });
});

Parse.Cloud.afterSave('Session', function(req) {
  let user = req.user;
  const token = user.getSessionToken();

  user.increment('totalTime', req.object.get('finishTime'));
  user.save({sessionToken: token}, {
    success: function(resultingUser) {
      res.success('OK');
    },
    error: function(resultingUser, error) {
      res.error(error.code, error.message);
    }
  });
});
