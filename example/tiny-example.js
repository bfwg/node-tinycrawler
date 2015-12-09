"use strict";
var express = require('express');
var app     = express();
var Crawler = require('../lib/crawler');
var cheerio = require('cheerio');
var fs      = require('fs');

app.get('/', (req, res) => {

  var time = Date.now();
  var crawler = new Crawler('http://www.vanpeople.com/c/list/139.html');
  // var crawler = new Crawler('http://www.taobao.com/');
  // var crawler = new Crawler('http://cgiffard.com/');
  // var crawler = new Crawler('http://www.yicity.com/');
  // var crawler = new Crawler('http://www.quotemedia.com/');
  // crawler.maxDepth = 4;
  // crawler.crawlInterval = 10;
  // crawler.maxListenerCurrency = 10;
  // crawler.redisQueue = true;


  crawler.addFetchCondition((url) => {
    if(!!url.path.match(/\/c\/[0-9]*\.html/i) ||!!url.path.match(/.*\/c\/uploadpic\/.*.jpg/i))
      return true;
    else
      return false;
  });


  crawler.on('start', () => {
    console.log('Start crawling');
  });


  crawler.on("fetcherror", (a, b) => {
    console.log(b.statusCode);
  });

  crawler.on('timeout', () => {
    console.log('timeout');
  });

  crawler.on('fetchstart', (queueItem, options) => {
    options.headers.cookie = ["ci_session=a%3A7%3A%7Bs%3A10%3A%22session_id%22%3Bs%3A32%3A%22502c8b6a0e5b52b8e57e52350af5dbd0%22%3Bs%3A10%3A%22ip_address%22%3Bs%3A11%3A%2299.199.7.29%22%3Bs%3A10%3A%22user_agent%22%3Bs%3A105%3A%22Mozilla%2F5.0+%28X11%3B+Linux+x86_64%29+AppleWebKit%2F537.36+%28KHTML%2C+like+Gecko%29+Chrome%2F43.0.2357.125+Safari%2F537.36%22%3Bs%3A13%3A%22last_activity%22%3Bi%3A1449684613%3Bs%3A9%3A%22user_data%22%3Bs%3A0%3A%22%22%3Bs%3A6%3A%22mobile%22%3Bi%3A1%3Bs%3A7%3A%22is_boot%22%3Bi%3A1%3B%7D5226068958d28931d37adba92a8f16ee; expires=Wednesday, 9 December 2015 at 12:10:18; path=/; domain=www.vanpeople.com"];
    console.log('start fetching', queueItem.url);
  });

  crawler.on('fetchredirect', (queueItem, targetl) => {
    console.log('REDIRECTED', queueItem.url, 'to', targetl);
  });

  crawler.on('fetchcomplete', (queueItem, buffer) => {
    // if (queueItem.stateData.contentType === 'image/jpeg') {
      // if (/[0-9a-z]*.jpg/.exec(queueItem.path))
        // fs.writeFile('img/' + (/[0-9a-z]*.jpg/.exec(queueItem.path))[0], buffer);
    // }


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
