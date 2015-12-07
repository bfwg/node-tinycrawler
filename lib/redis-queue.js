"use strict";
const redisClient = require('./redis-conifg.js');


var RedisQueue = function(host) {
  var redisQueue = this;
  redisQueue.namespace = host;
  redisQueue.lastFetchedIndexPrifex = `${host}:lastFetchedIndex`;
  redisQueue.scanedIndexPrifex = `${host}:scanedIndex`;
  redisQueue.fetchedCountPrifex = `${host}:fetchedCount`;
};

RedisQueue.prototype.add = function(protocol, host, port, path, depth, cb) {
  var redisQueue = this;
  var url = (protocol + "://" + host + (parseInt(port) !== 80 ? ":" + port : "") + path).toLowerCase();

  //add to set if not exists, also init with false means feached is false
  redisClient.saddAsync(redisQueue.scanedIndexPrifex, url)
  .then(success => {
    //insert if not exist
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
    //set lastFetchedIndex to 0 if it's not in the redis
    .setnx(redisQueue.lastFetchedIndexPrifex, 0)
    //get lastFetchedIndex
    .get(redisQueue.lastFetchedIndexPrifex)
    .exec((err, replies) => {
      var lastFetchedIndex = parseInt(replies[1]);
      //get all the element from the list starting from lastFetchedIndex to the end
      redisClient.lrangeAsync(redisQueue.namespace, lastFetchedIndex, -1)
      .then((queueArray) => {
        //check if there's still room for unchecks
        if (queueArray.length) {
          //checkk for those rooms
          for (let i = 0; i < queueArray.length; i++) {
            let queueItem = JSON.parse(queueArray[i]);
            //if status is still "inQueue"
            if (queueItem.status === 'inQueue') {
              //increase the lastFetchedIndex by i
              redisClient.incrbyAsync(redisQueue.lastFetchedIndexPrifex, i)
              .then(idx => {
                //call back and pass the queueItem
                cb(null, queueItem, idx);
              });
              break;
            } else if (i === queueArray.length - 1) {
              //we loop to the last element and
              //No item in queue
              cb(new Error('No unfetched items remain'));
            }
          }
        } else {
          //this will happen if lastFetchedIndex is equal to the length of our queue
          //which means no item in queue
          cb(new Error('No unfetched items remain'));
        }
      });
    });

};


RedisQueue.prototype.updateByIndex = function(queueItem, index, fetchedUrl) {
  var redisQueue = this;
  redisClient.lset(redisQueue.namespace, index, JSON.stringify(queueItem));
  if (fetchedUrl)
    redisClient.incr(redisQueue.fetchedCountPrifex);
};

RedisQueue.prototype.complete = function(cb) {

  var redisQueue = this;
  redisClient.multi()
  .llen(redisQueue.namespace)
  .get(redisQueue.fetchedCountPrifex)
  .exec((err, result) => {
    if (result[0] === parseInt(result[1]))
      cb(null, result[0]);
    else {
      var error = new Error("Unfetched Item still in queue");
      cb(error);
    }
  });


};

module.exports = RedisQueue;

