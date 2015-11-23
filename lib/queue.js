"use strict";
var Queue = function() {
  var queue = this;
  queue.lastFetchedIndex = 0;
  queue.scanedIndex = {};
};

Queue.prototype = [];

Queue.prototype.add = function(url, cb) {
  var queue = this;
  if(!queue.exists(url)) {
    var queueItem = {
      url: url,
      status: 'queued'
    };
    queue.push(queueItem);
    cb(null, queueItem);
  } else {
    var error = new Error("Resource already exists in queue!");
    cb(error);
  }
};

Queue.prototype.exists = function(url) {
  var queue = this;
  if(queue.scanedIndex[url])
    return 1;
  queue.scanedIndex[url] = true;
  return 0;
};

module.exports = Queue;
