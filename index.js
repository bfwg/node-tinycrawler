"use strict";
var express = require('express');
var app     = express();
var Crawler = require('./lib/crawler');

app.get('/', (req, res) => {
  var crawler = new Crawler('http://www.example.com');


  crawler.on('start', () => {
    console.log('start crawling');
  });

  crawler.on('end', () => {
    console.log('finished crawling');
  });

  crawler.on('end', () => {
    console.log('finished crawling');
  });

  crawler.start();

  res.send('<p style="color: green;">Check your console!</p>');
});
app.listen('3002');
console.log('Crawling happens on port 3002');
module.exports = app;
