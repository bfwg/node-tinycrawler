"use strict";
var express = require('express');
var app     = express();
var Crawler = require('./lib/crawler');
var cheerio = require('cheerio');

app.get('/', (req, res) => {

  var count = 0;
  var crawler = new Crawler('http://www.cgiffard.com');
  crawler.interval = 1;
  crawler.maxDepth = 0;
  crawler.maxListenerCurrency = 100;


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
    count++;
    console.log('finished fetching', queueItem.url);
  });

  crawler.on('complete', () => {
    console.log(count);
    console.log('Finished crawling');
  });


  crawler.start();

  res.send('<p style="color: green;">Check your console!</p>');
});
app.listen('3002');
console.log('Crawling happens on port 3002');
module.exports = app;
