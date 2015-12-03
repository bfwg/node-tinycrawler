"use strict";
var config = require('../config'),
    redis = require('redis'),
    Promise = require('bluebird');
Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);


var RedisQueue = function(host, port) {

  this.redisClient = redis.createClient({
    host: host,
    port: port,
  });

};

RedisQueue.prototype.add = function(protocol, host, port, path, depth, cb) {
  var url = (protocol + "://" + host + (port !== 80 ? ":" + port : "") + path).toLowerCase();
  this.redisClient.hsetnxAsync(url)
  // //if not exists
  // if (!this.scanedIndex[url]) {
    // var queueItem = {
      // url: url,
      // protocol: protocol,
      // host: host,
      // port: port,
      // path: path,
      // depth: depth,
      // fetched: false,
      // status: 'inQueue',
      // stateData: {}
    // };
    // this.push(queueItem);
    // this.scanedIndex[url] = true;
    // cb(null, queueItem);
  // } else {
    // var error = new Error("Resource already exists in queue!");
    // error.code = "DUP";
    // cb(error);
  // }

};

module.exports = RedisQueue;

