# Tiny web-crawler for Node.js
This is a tiny web crawler under 1000 lines of code. 
# Usage
```javascript

var Crawler = require('../lib/crawler')
var crawler = new Crawler('http://www.someUrl.com');

// crawler.maxDepth = 4;
// crawler.crawlInterval = 10;
// crawler.maxListenerCurrency = 10;
// crawler.redisQueue = true;
crawler.start();
```
## Lifecycle:
start => fetcherror | timeout => fetchcomplete | fetchredirect => complete

### start
```javascript
crawler.on('start', () => {
    console.log('Start crawling');
})
```

### fetcherror | timeout
```javascript
crawler.on("fetcherror", (a, b) => {
  console.log(b.statusCode);
});

crawler.on('timeout', () => {
  console.log('timeout');
});
```
### fetchcomplete | fetchredirect
```javascript
crawler.on('fetchredirect', (queueItem, targetl) => {
  console.log('REDIRECTED', queueItem.url, 'to', targetl);
});

crawler.on('fetchcomplete', (queueItem, buffer) => {
  // Do whatever you want with queueItem or buffer
  console.log('finished fetching', queueItem.url);
});
```

## More options

### maxDepth
The maximum depth crawler allow to go.

### crawlInterval
The interval for dispatching crawlers.

### maxListenerCurrency
How many crawlers are we dispatching at the same time.

### redisQueue
For bigger websides, default in memory queue might not be enough. 
Install redis first and [config tiny-crawler to use redis queue](https://github.com/bfwg/node-tinycrawler/blob/master/lib/redis-queue.js#L25).

This repository is heavily influenced by [node-simple-crawler](https://github.com/cgiffard/node-simplecrawler)
