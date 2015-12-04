"use strict";
const redisClient = require('./redis-conifg.js');

var RedisQueue = function(host) {
  var redisQueue = this;
  redisQueue.namespace = host;
  redisQueue.lastFetchedIndexPrifex = `${host}:lastFetchedIndex`;
  redisQueue.scanedIndexPrifex = `${host}:scanedIndex`;
};

RedisQueue.prototype.add = function(protocol, host, port, path, depth, cb) {
  var redisQueue = this;
  var url = (protocol + "://" + host + (port !== 80 ? ":" + port : "") + path).toLowerCase();
  //insert if not exist
  console.log('adding', url);
  redisClient.hsetnxAsync(redisQueue.scanedIndexPrifex, url, true)
  .then(success => {
    //insert
    if (success) {
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
      redisClient.rpushAsync(redisQueue.namespace, JSON.stringify(queueItem))
      .then(() => {
        cb(null, queueItem);
      });
    } else {
      //exist alrealy and insert fail
      var error = new Error("Resource already exists in queue!");
      error.code = "DUP";
      cb(error);
    }
  });

};


RedisQueue.prototype.oldestUnfetchedItem = function(cb) {
  var redisQueue = this;

  //set lastFetchedIndex if it not exists
  redisClient.multi()
    .setnx(redisQueue.lastFetchedIndexPrifex, 0)
    .get(redisQueue.lastFetchedIndexPrifex)
    .exec((err, replies) => {
      var lastFetchedIndex = parseInt(replies[1]);
      redisClient.lrangeAsync(redisQueue.namespace, lastFetchedIndex, -1)
      .then((queueArray) => {
        for (let i = 0; i < queueArray; i++) {
          if (queueArray[i].status === 'inQueue') {
            redisClient.incrby(redisQueue.lastFetchedIndexPrifex, i);
            cb(null, queueArray[i]);
            return queueArray[i];
          }
        }
        //No item in queue
        cb(new Error('No unfetched items remain'));
        return false;
      });
    });

};



RedisQueue.prototype.complete = function() {
  // var completeCount = 0;
  // this.forEach((item) => {
    // if (item.fetched)
      // completeCount++;
  // });

  // if(completeCount === this.length)
    return true;
  // else
    // return false;

};

module.exports = RedisQueue;

