
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.afterSave('Session', function(request) {
  request.user.increment('totalTime', request.object.get('finishTime'));
  request.user.save();
});
