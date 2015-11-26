"use strict";
var Queue = function() {
  var queue = this;
  queue.lastFetchedIndex = 0;
  queue.scanedIndex = {};
};

Queue.prototype = [];

Queue.prototype.add = function(protocol, host, port, path, depth, cb) {
  var url = protocol + "://" + host + (port !== 80 ? ":" + port : "") + path;
  if (!this.scanedIndex[url.toLowerCase()]) {
    var queueItem = {
      url: url,
      protocol: protocol,
      host: host,
      port: port,
      path: path,
      depth: depth,
      fetched: false,
      status: 'inQueue',
      stateData: {}
    };
    this.push(queueItem);
    this.scanedIndex[url] = true;
    cb(null, queueItem);
  } else {
    var error = new Error("Resource already exists in queue!");
    error.code = "DUP";
    cb(error);
  }

  console.log(protocol);
  console.log(host);
  console.log(port);
  console.log(path);
  console.log(depth);

};


// Get first unfetched item in the queue (and return item or false)
Queue.prototype.oldestUnfetchedItem = function(cb) {
  for (let i = this.lastFetchedIndex; i < this.length; i++) {
    if (this[i].status === 'inQueue') {
      this.lastFetchedIndex = i;
      cb(null, this[i]);
      return this[i];
    }
  }

  //No item in queue
  cb(new Error('No unfetched items remain'));
  return false;
};

Queue.prototype.complete = function() {
  var completeCount = 0;
  this.forEach((item) => {
    if (item.fetched)
      completeCount++;
  });

  if(completeCount === this.length)
    return true;
  else
    return false;

};

module.exports = Queue;
