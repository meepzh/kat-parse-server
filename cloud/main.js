const passwordModule = require('password');

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('gpw', function(req, res) {
  res.success(passwordModule(4));
});

Parse.Cloud.afterSave('Session', function(request) {
  request.user.increment('totalTime', request.object.get('finishTime'));
  request.user.save();
});
