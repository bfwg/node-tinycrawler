"use strict";
var EventEmitter = require("events").EventEmitter,
    util         = require('util'),
    Queue        = require('./queue');

var Crawler = function(url) {
  var crawler = this;
  crawler.url                 = url;
  crawler.crawlInterval       = 1000;
  crawler.running             = false;
  crawler.openRequest         = 0;
  crawler.maxListenerCurrency = 5;
  crawler.queue               = new Queue();


};

util.inherits(Crawler, EventEmitter);

Crawler.prototype.start = function() {
  var crawler = this;
  //add to queue
  crawler.queue.add(crawler.url, err => {
    if(err)
      throw Error;
  });

  //every xxx dispatch a crawler
  crawler.crawlerIntervalId = setInterval(() => {
    crawler.crawl();
  }, crawler.crawlInterval);

  crawler.emit('start');
  crawler.running = true;

  //kick off first crawler
  process.nextTick(() => {
    crawler.crawl();
  });
};

Crawler.prototype.crawl = function() {
  var crawler = this;
  if(crawler.openRequest >= crawler.maxListenerCurrency) return;

  //if( fetcholdestitem ) => (item) => fetchItem();

  clearInterval(crawler.crawlerIntervalId);
  crawler.emit('end');
};

module.exports = Crawler;
