"use strict";
var EventEmitter = require("events").EventEmitter,
    util         = require('util'),
    MetaInfo     = require("../package.json"),
    uri          = require('urijs'),
    Queue        = require('./queue'),
    http         = require("http"),
    https        = require("https");

var QUEUE_ITEM_INITIAL_DEPTH = 0;

var Crawler = function(url) {
  var crawler = this;
  // Parse the URL first
  var tempurl = uri(url);

  //we can't crawl without a protocol
  //https://github.com/medialize/URI.js/issues/187
  if (!tempurl.protocol()) {
    url = uri('http://' + url);
  } else {
    url = tempurl;
  }

  //init the var we need
  crawler.protocol = url.protocol();

  //do a little check on the hostname since protocol is 100% there
  if (!url.hostname()) {
      throw new Error("Can't crawl with unspecified hostname.");
  }

  crawler.host = url.hostname();

  crawler.path = url.path() || '/';

  crawler.port = url.port() || '80';

  crawler.crawlInterval       = 1000;

  crawler.running             = false;

  crawler.openRequest         = 0;

  crawler.maxListenerCurrency = 5;
  crawler.queue               = new Queue();

  //5 minutes we wait for the request
  crawler.timeout = 5 * 60 * 1000;

  //16MB
  crawler.maxinumResourceSize = 16 * 1024 * 1024;

  crawler.userAgent = "Node/" + MetaInfo.name + " " + MetaInfo.version +
            " (" + MetaInfo.repository.url + ")";

  // Supported MIME-types
  // Matching MIME-types will be scanned for links
  crawler.supportedMimeTypes = [
      /^text\//i,
      /^application\/(rss|html|xhtml)?[\+\/\-]?xml/i,
      /^application\/javascript/i,
      /^xml/i
  ];


  // Regular expressions for finding URL items in HTML and text
  crawler.discoverRegex = [
      /\s?(?:href|src)\s?=\s?(["']).*?\1/ig,
      /\s?(?:href|src)\s?=\s?[^"'][^\s>]+/ig,
      /\s?url\((["']).*?\1\)/ig,
      /\s?url\([^"'].*?\)/ig,

      // This could easily duplicate matches above, e.g. in the case of
      // href="http://example.com"
      /http(s)?\:\/\/[^?\s><\'\"]+/ig,

      // This might be a bit of a gamble... but get hard-coded
      // strings out of javacript: URLs. They're often popup-image
      // or preview windows, which would otherwise be unavailable to us.
      // Worst case scenario is we make some junky requests.
      /^javascript\:[a-z0-9\$\_\.]+\(['"][^'"\s]+/ig
  ];
  //init -1 mean no max depth
  crawler.maxDepth = -1;

  var hiddenProps = {
    _openRequests: 0,
    _fetchConditions: []
  };

  // Run the EventEmitter constructor
  EventEmitter.call(crawler);

  // Apply all the hidden props
  Object.keys(hiddenProps).forEach(function(key) {
      Object.defineProperty(crawler, key, {
          writable: true,
          enumerable: false,
          value: hiddenProps[key]
      });
  });
};

util.inherits(Crawler, EventEmitter);



Crawler.prototype.start = function() {
  var crawler = this;
  if (!crawler.queue.length) {
    crawler.queue.add(
      crawler.protocol,
      crawler.host,
      crawler.port,
      crawler.path,
      QUEUE_ITEM_INITIAL_DEPTH,
      (err) => {
      if (err)
        throw err;
    });
  } else {
  //after implemented a redis storge we need to handle the else here
  //for now just leave it
  }
  //Teh run loop machanisum
  //Here
  process.nextTick(() => {
    //the run loop
    crawler.crawlerIntervalId = setInterval(() => {

      crawler.crawl();

    }, crawler.crawlInterval);
    //kick off first one
    crawler.crawl();
  });

  crawler.running = true;
  crawler.emit('start');
};

Crawler.prototype.crawl = function() {
  var crawler = this;

  if (crawler._openRequests >= crawler.maxListenerCurrency) return;


  //go get the item
  crawler.queue.oldestUnfetchedItem((err, queueItem) => {
    if (queueItem) {
      //got the item start the fetch
      crawler.fetchQueueItem(queueItem);
    } else if (crawler._openRequests === 0 && crawler.queue.complete()) {
      //no open Request, no unfetcheditem stop the crawler
      crawler.emit("complete");
      clearInterval(crawler.crawlerIntervalId);
      crawler.running = false;
    }

  });
};

Crawler.prototype.fetchQueueItem = function(queueItem) {
  var crawler = this;
  crawler._openRequests++;

  queueItem.status = 'spooled';

  var requestOptions, //The option for our request
      clientRequest,  //The request obj
      timeCommenced;  //The time we started the request

  var client = queueItem.protocol === 'http' ? http : https;

  requestOptions = {
    method: "GET",
    host:   queueItem.host,
    path:   queueItem.path,
    headers: {
      "User-Agent": crawler.userAgent,
      "Host":       queueItem.host + ( queueItem.port !== 80 ?  ':' + queueItem.port : '')
    }
  }

  if (queueItem.referrer)
    requestOptions.headers.Referer = queueItem.referrer;

  //emit fetchstart
  crawler.emit('fetchstart', queueItem, requestOptions);

  timeCommenced = Date.now();

  //now the exciting moment we start the request!
  clientRequest = client.request(requestOptions, (response) => {
    crawler.handleResponse(queueItem, response, timeCommenced);
  });
  clientRequest.end();

  clientRequest.setTimeout(crawler.timeout, () => {
    if (queueItem.fetched) return;

    if (crawler.running)
      crawler._openRequests--;

    queueItem.fetched = true;
    queueItem.status = 'timeout';
    crawler.emit('timeout', queueItem, crawler.timeout);
    clientRequest._crawlerhandled = true;
    clientRequest.abort();
  });

  clientRequest.on('error', (error) => {
    if (clientRequest._crawlerhandled) return;

    if (!queueItem.fetch && crawler.running)
      crawler._openRequests--;

    queueItem.fetched = true;
    queueItem.status = 'failed';
    queueItem.stateData.code = 599;
    crawler.emit('fetchclienterror', error, queueItem);
  });

};

Crawler.prototype.handleResponse = function(queueItem, response, timeCommenced) {
  var crawler = this;
  //TODO
  console.log('header: ', response.headers);
  crawler._openRequests--;
  queueItem.fetched = true;
  queueItem.status = 'success';
}

module.exports = Crawler;
