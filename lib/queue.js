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


module.exports = Queue;
