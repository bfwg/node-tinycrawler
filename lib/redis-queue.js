'use strict';

var Promise = require('bluebird'),
    redis   = require('redis');


//Redis set up
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);



var RedisQueue = function(host) {
  var redisQueue = this;
  redisQueue.namespace = host;
  redisQueue.lastFetchedIndexPrifex = `${host}:lastFetchedIndex`;
  redisQueue.scanedIndexPrifex = `${host}:scanedIndex`;

  //set lastFetchedIndex to 0 if it's not in the redis
  redisQueue.setnx(redisQueue.lastFetchedIndexPrifex, 0);
};


//extend the queue to redis
RedisQueue.prototype = redis.createClient({
  host: '127.0.0.1',
  port: 6379,
});

RedisQueue.prototype.add = function(protocol, host, port, path, depth, cb) {
  var redisQueue = this;
  var url = (protocol + "://" + host + (parseInt(port) !== 80 ? ":" + port : "") + path).toLowerCase();

  //add to set if not exists, also init with false means feached is false
  redisQueue.saddAsync(redisQueue.scanedIndexPrifex, url)
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
      redisQueue.rpushAsync(redisQueue.namespace, JSON.stringify(queueItem))
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

  //get lastFetchedIndex
  redisQueue.getAsync(redisQueue.lastFetchedIndexPrifex)
  .then(indexStr => {
    var lastFetchedIndex = parseInt(indexStr);
    //get all the element from the list starting from lastFetchedIndex to the end
    redisQueue.lrangeAsync(redisQueue.namespace, lastFetchedIndex, lastFetchedIndex + 99) //first 100 http://redis.io/topics/benchmarks
    .then((queueArray) => {
      //check if there's still room for unchecks
      if (queueArray.length) {
        //checkk for those rooms
        for (let i = 0; i < queueArray.length; i++) {
          let queueItem = JSON.parse(queueArray[i]);
          //if status is still "inQueue"
          if (queueItem.status === 'inQueue') {
            //increase the lastFetchedIndex by i
            redisQueue.incrbyAsync(redisQueue.lastFetchedIndexPrifex, i)
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
  })
  .catch(err => {
    cb(err);
  });

};


RedisQueue.prototype.updateByIndex = function(queueItem, index) {
  var redisQueue = this;
  redisQueue.lset(redisQueue.namespace, index, JSON.stringify(queueItem));
};

RedisQueue.prototype.complete = function(cb) {
  var redisQueue = this;
  redisQueue.getAsync(redisQueue.lastFetchedIndexPrifex)
  .then(completeIndex => {
    //put the last fetchindex + 1 which is the fetched count to cb
    cb(null, (parseInt(completeIndex) + 1));
  })
  .catch(err => {
    cb(err);
  });
  // RedisQueue.multi()
  // .llen(redisQueue.namespace)
  // .get(redisQueue.lastFetchedIndexPrifex)
  // .exec((err, result) => {
    // if (result[0] === (parseInt(result[1]) + 1))
      // cb(null, result[0]);
    // else {
      // var error = new Error("Unfetched Item still in queue");
      // cb(error);
    // }
  // });
};


// Gets the number of items in the queue
RedisQueue.prototype.getLength = function(callback) {
  var redisQueue = this;
  redisQueue.llenAsync(redisQueue.namespace)
  .then(len => {
    callback(null, len);
  })
  .catch(err => {
    callback(err);
  });
};

module.exports = RedisQueue;

