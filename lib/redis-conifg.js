'use strict';

const redis = require('redis');
const Promise = require('bluebird');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

const redisClient = redis.createClient({
  host: '127.0.0.1',
  port: 6379,
});

module.exports = redisClient;
