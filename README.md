# Tiny web-crawler for Node.js
This is a tiny web crawler under 1000 lines of code. 
# Usage
```js

var Crawler = require('../lib/crawler')
var crawler = new Crawler('http://www.someUrl.com');


// crawler.maxDepth = 4;
// crawler.crawlInterval = 10;
// crawler.maxListenerCurrency = 10;
// crawler.redisQueue = true;
crawler.start();
```

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
```
