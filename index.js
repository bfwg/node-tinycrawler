"use strict";
var express = require('express');
var app     = express();
var Crawler = require('./lib/crawler');
var cheerio = require('cheerio');

app.get('/', (req, res) => {

  var time = Date.now();
  // var crawler = new Crawler('http://www.vanpeople.com/');
  // var crawler = new Crawler('http://cgiffard.com/');
  // var crawler = new Crawler('http://www.yicity.com/');
  var crawler = new Crawler('http://www.quotemedia.com/');
  // crawler.crawlInterval = 10;
  // crawler.maxListenerCurrency = 10;
  crawler.redisQueue = true;


  // crawler.addFetchCondition((purl) => {
    // return !!purl.path.match(/\/c\/[0-9]*\.html/);
  // });

  crawler.on('start', () => {
    console.log('Start crawling');
  });


  crawler.on("fetcherror", (a, b) => {
    console.log(b.statusCode);
  });

  crawler.on('timeout', () => {
    console.log('timeout');
  });

  crawler.on('fetchstart', (queueItem) => {
    console.log('start fetching', queueItem.url);
  });

  crawler.on('fetchredirect', (queueItem, targetl) => {
    console.log('REDIRECTED', queueItem.url, 'to', targetl);
  });

  crawler.on('fetchcomplete', (queueItem, buffer) => {
    // var html = buffer.toString();
    // var $ = cheerio.load(html);
    // $('.show a strong').each(function(i, element){
      // console.log($(element).text());
    // });
    console.log('finished fetching', queueItem.url);
  });

  crawler.on('complete', (count) => {
    console.log('Url found: ' + count);
    console.log('Time to crawl: ' + millisToMinutesAndSeconds(Date.now() - time));
    console.log('Finished crawling');
  });

  function millisToMinutesAndSeconds(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  }

  crawler.start();

  res.send('<p style="color: green;">Check your console!</p>');
});
app.listen('3002');
console.log('Crawling happens on port 3002');
module.exports = app;
