"use strict";
var Queue = function() {
  var queue = this;
  queue.lastFetchedIndex = 0;
  queue.scanedIndex = {};
};

Queue.prototype = [];

Queue.prototype.add = function(protocol, host, port, path, depth, cb) {
  var url = (protocol + "://" + host + (parseInt(port) !== 80 ? ":" + port : "") + path).toLowerCase();
  //if not exists
  if (!this.scanedIndex[url]) {
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

};


// Get first unfetched item in the queue (and return item or false)
Queue.prototype.oldestUnfetchedItem = function(cb) {
  for (let i = this.lastFetchedIndex; i < this.length; i++) {
    if (this[i].status === 'inQueue') {
      this.lastFetchedIndex = i;
      cb(null, this[i], i);
      return this[i];
    }
  }

  //No item in queue
  cb(new Error('No unfetched items remain'));
  return false;
};

Queue.prototype.complete = function(cb) {
  var completeCount = 0;
  this.forEach((item) => {
    if (item.fetched)
      completeCount++;
  });

  cb(null, completeCount);
  return completeCount;
};

// Gets the number of items in the queue
Queue.prototype.getLength = function(callback) {
  callback(null, this.length);
};



Queue.prototype.updateByIndex = function(queueItem, index) {};

module.exports = Queue;
