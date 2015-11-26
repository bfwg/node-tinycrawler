"use strict";
var EventEmitter = require("events").EventEmitter,
    util         = require('util'),
    MetaInfo        = require("../package.json"),
    Queue        = require('./queue');

var Crawler = function(url) {
  var crawler = this;
  // Parse the URL first
  url = uri(url);
  //init the var we need
  crawler.protocol = url.protocol() || 'http';

  crawler.host = url.hostname() || '';

  crawler.path = url.path() || '/';

  crawler.port = url.port() || '80';

  crawler.crawlInterval       = 1000;

  crawler.running             = false;

  crawler.openRequest         = 0;

  crawler.maxListenerCurrency = 5;
  crawler.queue               = new Queue();

  //5 minutes
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

  var hiddenProps {
    _openRequests: 0,
    _fetchConditions: []
  }

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
};

Crawler.prototype.crawl = function() {
  var crawler = this;
};

module.exports = Crawler;
