"use strict";
var EventEmitter = require("events").EventEmitter,
    util         = require('util'),
    uri          = require('urijs'),
    Queue        = require('./queue'),
    RedisQueue   = require('./redis-queue'),
    http         = require("http"),
    zlib         = require("zlib"),
    https        = require("https");

var QUEUE_ITEM_INITIAL_DEPTH = 1;

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

  crawler.crawlInterval       = 250;

  crawler.running             = false;

  crawler.openRequest         = 0;

  crawler.maxListenerCurrency = 5;

  crawler.redisQueue          = false;



  //5 minutes we wait for the request
  crawler.timeout = 5 * 60 * 1000;

  //If this is false you will crawl the WHOLE INTERNET
  crawler.filterByDomain = true;

  //this set to true will cause download everything
  crawler.downloadUnsupported = true;
  //16MB
  crawler.maxResourceSize = 16 * 1024 * 1024;

  crawler.userAgent = "Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0";

  // The HTTP / HTTPS agent used to crawl
  crawler.httpAgent       = http.globalAgent;
  crawler.httpsAgent      = https.globalAgent;

  // Supported Protocols
  crawler.allowedProtocols = [
      /^http(s)?$/i,                  // HTTP & HTTPS
      /^(rss|atom|feed)(\+xml)?$/i    // RSS / XML
  ];

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
      /\s?(?:href|src)\s?=\s?[^"'\s][^\s>]+/ig,
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

  crawler.maxDepth = 0;

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

  //weather the queue is using redis or not
  crawler.queue = crawler.redisQueue ? new RedisQueue(crawler.host) : new Queue();

  //add to the queue
  crawler.queue.getLength((err, len) => {
    if (err)
      throw err;
    if (!len) {
      crawler.queue.add(
        crawler.protocol,
        crawler.host,
        crawler.port,
        crawler.path,
        QUEUE_ITEM_INITIAL_DEPTH,
        (err) => {
        if (err)
          throw err;
        //Main run loop machanisum
        crawler.run();
      });
    } else {
      //fire the run queue with out add item
      crawler.run();
    }
  });

};


Crawler.prototype.run = function() {
  var crawler = this;
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
}


Crawler.prototype.crawl = function() {
  var crawler = this;

  if (crawler._openRequests >= crawler.maxListenerCurrency) return;


  //go get the item
  crawler.queue.oldestUnfetchedItem((err, queueItem, index) => {
    if (queueItem) {
      //got the item start the fetch
      crawler.fetchQueueItem(queueItem, index);
    } else if (crawler._openRequests === 0) {
      crawler.queue.complete((err, completeCount) => {
        if (err)
          throw err;
        crawler.queue.getLength((err, length) => {
          if (err)
            throw err;
          if (length === completeCount) {
            //no open Request, no unfetcheditem stop the crawler
            crawler.emit("complete", completeCount);
            clearInterval(crawler.crawlerIntervalId);
            crawler.running = false;
          }
        });
      });
    }

  });
};


Crawler.prototype.fetchQueueItem = function(queueItem, itemIndex) {
  var crawler = this;
  crawler._openRequests++;

  queueItem.status = 'spooled';
  //always call update Redis when a member of queueItem has changed
  crawler.queue.updateByIndex(queueItem, itemIndex);


  var requestOptions, //The option for our request
      clientRequest,  //The request obj
      timeCommenced;  //The time we started the request

  var client = queueItem.protocol === 'http' ? http : https;
  var agent  = queueItem.protocol === "https" ? crawler.httpsAgent : crawler.httpAgent;

  requestOptions = {
    method: "GET",
    host:   queueItem.host,
    path:   queueItem.path,
    agent:  agent,
    headers: {
      "User-Agent": crawler.userAgent,
      "Host":       queueItem.host + ( parseInt(queueItem.port) !== 80 ?  ':' + queueItem.port : '')
    }
  };

  if (queueItem.referrer)
    requestOptions.headers.Referer = queueItem.referrer;

  //emit fetchstart
  crawler.emit('fetchstart', queueItem, requestOptions);

  timeCommenced = Date.now();

  //now the exciting moment we start the request!
  clientRequest = client.request(requestOptions, (response) => {
    crawler.handleResponse(queueItem, response, timeCommenced, itemIndex);
  });
  clientRequest.end();

  clientRequest.setTimeout(crawler.timeout, () => {
    if (queueItem.fetched) return;

    if (crawler.running)
      crawler._openRequests--;

    queueItem.fetched = true;
    queueItem.status = 'timeout';
    //update redis
    crawler.queue.updateByIndex(queueItem, itemIndex);

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
    //update redis
    crawler.queue.updateByIndex(queueItem, itemIndex);

    crawler.emit('fetchclienterror', error, queueItem);
  });

};

Crawler.prototype.handleResponse = function(queueItem, response, timeCommenced, itemIndex) {
  var crawler = this,
      dataReceived = false,
      timeHeadersReceived,
      timeDataReceived,
      responseBuffer,
      responseLength,
      responseLengthReceived = 0,
      contentType,
      stateData = queueItem.stateData;


  // Record what time we first received the header information
  timeHeadersReceived = Date.now();

  // If we weren't passed a time of commencement, assume Now()
  timeCommenced = timeCommenced || Date.now();

  // Ensure response length is reasonable...
  responseLength = parseInt(response.headers["content-length"], 10);
  responseLength = !isNaN(responseLength) ? responseLength : 0;
  responseLength = responseLength > 0 ? responseLength : crawler.maxResourceSize;

  // Save timing and content some header information into queue
  stateData.requestLatency    = timeHeadersReceived - timeCommenced;
  stateData.requestTime       = timeHeadersReceived - timeCommenced;
  stateData.contentLength     = responseLength;
  stateData.contentType       = contentType = response.headers["content-type"];
  stateData.code              = response.statusCode;
  stateData.headers           = response.headers;
  stateData.contentLength     = responseLength;



  // If we should just go ahead and get the data
  if (response.statusCode >= 200 && response.statusCode < 300 &&
    responseLength <= crawler.maxResourceSize) {

    queueItem.status = "ok";

    // Create a buffer with our response length
    responseBuffer = new Buffer(responseLength);

    // Only if we're prepared to download non-text resources...
    if (crawler.downloadUnsupported || crawler.mimeTypeSupported(contentType)) {
      response.on("data", receiveData);
      response.on("end", receiveData);
    } else {
      queueItem.fetched = true;
      //update redis
      crawler.queue.updateByIndex(queueItem, itemIndex);

      crawler._openRequests--;

      response.socket.destroy();
    }

  // We've got a not-modified response back
  } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
    if (response.statusCode === 304) {
      //we are most likely not going to get this
      console.log('304!!!!');
    }

    queueItem.fetched = true;
    queueItem.status = "redirected";
    //update redis
    crawler.queue.updateByIndex(queueItem, itemIndex);

    // Emit redirect event
    crawler.emit("fetchredirect", queueItem, response.headers.location, response);

    // Clean URL, add to queue...
    crawler.queueURL(response.headers.location, queueItem);
    response.socket.end();

    crawler._openRequests--;

  // Ignore this request, but record that we had a 404
  } else if (response.statusCode === 404 || response.statusCode === 410) {
    queueItem.fetched = true;
    queueItem.status = "notfound";
    //update redis
    crawler.queue.updateByIndex(queueItem, itemIndex);

    // Emit 404 event
    crawler.emit("fetch404", queueItem, response);
    response.socket.end();

    crawler._openRequests--;

  //other 400s, 500s, etc
  } else {
    queueItem.fetched = true;
    queueItem.status = "failed";
    //update redis
    crawler.queue.updateByIndex(queueItem, itemIndex);

    // Emit 5xx / 4xx event
    crawler.emit("fetcherror", queueItem, response);
    response.socket.destroy();

    crawler._openRequests--;
  }


  function receiveData(chunk) {
    if (chunk && chunk.length && !dataReceived) {
      if (responseLengthReceived + chunk.length > responseBuffer.length) {
        // Oh dear. We've been sent more data than we were initially told.
        // This could be a mis-calculation, or a streaming resource.
        // Let's increase the size of our buffer to match, as long as it isn't
        // larger than our maximum resource size.

        if (responseLengthReceived + chunk.length <= crawler.maxResourceSize) {

          // Start by creating a new buffer, which will be our main
          // buffer from now on...

          var tmpNewBuffer = new Buffer(responseLengthReceived + chunk.length);

          // Copy all our old data into it...
          responseBuffer.copy(tmpNewBuffer, 0, 0, responseBuffer.length);

          // And now the new chunk
          chunk.copy(tmpNewBuffer, responseBuffer.length, 0, chunk.length);

          // And now make the response buffer our new buffer,
          // leaving the original for GC
          responseBuffer = tmpNewBuffer;

        } else {
          // Oh dear oh dear! The response is not only more data
          // than we were initially told, but it also exceeds the
          // maximum amount of data we're prepared to download per
          // resource.
          //
          // Throw error event and ignore.
          //
          // We'll then deal with the data that we have.

          crawler.emit("fetchdataerror", queueItem, response);
        }
      } else {
          // Copy the chunk data into our main buffer
          chunk.copy(responseBuffer, responseLengthReceived, 0, chunk.length);
      }

      // Increment our data received counter
      responseLengthReceived += chunk.length;
    }

    if ((responseLengthReceived >= responseLength || response.complete) &&
      !dataReceived) {

      // Slice the buffer to chop off any unused space
      responseBuffer = responseBuffer.slice(0, responseLengthReceived);

      dataReceived = true;

      processReceivedData();
    }
  }

  // Function for dealing with 200 responses
  function processReceivedData() {
    if (queueItem.fetched) {
        return;
    }

    timeDataReceived = new Date().getTime();

    queueItem.fetched = true;
    queueItem.status = "downloaded";

    // Save state information
    stateData.downloadTime      = timeDataReceived - timeHeadersReceived;
    stateData.requestTime       = timeDataReceived - timeCommenced;
    stateData.actualDataSize    = responseBuffer.length;
    stateData.sentIncorrectSize = responseBuffer.length !== responseLength;
    //update redis
    crawler.queue.updateByIndex(queueItem, itemIndex);


    crawler.emit("fetchcomplete", queueItem, responseBuffer, response);

    // Is the item allowed by depth conditions ? depthAllow?
    if ((crawler.maxDepth === 0 || queueItem.depth <= crawler.maxDepth) && crawler.mimeTypeSupported(contentType))
      crawler.queueLinkedItems(responseBuffer, queueItem);

    crawler._openRequests--;
  }
};


Crawler.prototype.mimeTypeSupported = function(MIMEType) {
  var crawler = this;

  return crawler.supportedMimeTypes.reduce(function(prev, mimeCheck) {
      return prev || !!mimeCheck.exec(MIMEType);
  }, false);
};


Crawler.prototype.queueLinkedItems = function(resourceData, queueItem, decompressed) {
  var crawler = this,
      resources = [];

  if (!decompressed &&
    queueItem.stateData &&
    queueItem.stateData.headers["content-encoding"] && (
    queueItem.stateData.headers["content-encoding"].match(/gzip/) ||
    queueItem.stateData.headers["content-encoding"].match(/deflate/))) {

    return zlib.unzip(resourceData, function(err, newData) {
        if (err) {
            return crawler.emit("gziperror", queueItem, err, resourceData);
        }

        crawler.queueLinkedItems(newData, queueItem, true);
    });
  }

  resources = crawler.discoverResources(resourceData, queueItem);

  // Emit discovered resources. ie: might be useful in building a graph of
  // page relationships.
  crawler.emit("discoverycomplete", queueItem, resources);

  resources.forEach(function(url) {
      crawler.queueURL(url, queueItem);
  });
};

Crawler.prototype.queueURL = function(url, queueItem) {
  var crawler = this,
      parsedURL = crawler.processURL(url, queueItem);

  // URL Parser decided this URL was junky. Next please!
  if (!parsedURL) {
      return false;
  }

  // Pass this URL past fetch conditions to ensure the user thinks it's valid
  var fetchDenied = false;
  fetchDenied = crawler._fetchConditions.reduce(function(prev, callback) {
      return prev || !callback(parsedURL);
  }, false);

  if (fetchDenied) {
      // Fetch Conditions conspired to block URL
      return false;
  }


  // Check the domain is valid before adding it to the queue
  if (crawler.domainValid(parsedURL.host)) {
      crawler.queue.add(
          parsedURL.protocol,
          parsedURL.host,
          parsedURL.port,
          parsedURL.path,
          parsedURL.depth,
          function queueAddCallback(error, newQueueItem) {
            if (error) {
              // We received an error condition when adding the callback
              if (error.code && error.code === "DUP") {
                  return crawler.emit("queueduplicate", parsedURL);
              }

              return crawler.emit("queueerror", error, parsedURL);
            }

            crawler.emit("queueadd", newQueueItem, parsedURL);
            newQueueItem.referrer = queueItem.url;
          }
      );
  }

  return true;
};


Crawler.prototype.discoverResources = function(resourceData, queueItem) {
  // Convert to UTF-8
  // TODO: account for text-encoding.
  var resourceText = resourceData.toString("utf8"),
      crawler = this;


  // Rough scan for URLs
  return crawler.discoverRegex
      .reduce(function(list, regex) {
          return list.concat(
              crawler.cleanExpandResources(
                  resourceText.match(regex), queueItem));
      }, [])
      .reduce(function(list, check) {
          if (list.indexOf(check) < 0) {
              return list.concat([check]);
          }

          return list;
      }, []);
};

Crawler.prototype.cleanExpandResources = function (urlMatch, queueItem) {
  var crawler = this;


  if (!urlMatch)
    return [];


  return urlMatch
      .map(cleanURL.bind(this, queueItem))
      .reduce(function(list, URL) {

        // Ensure URL is whole and complete
        try {
            URL = uri(URL)
                .absoluteTo(queueItem.url || "")
                .normalize()
                .toString();
        } catch (e) {
            // But if URI.js couldn't parse it - nobody can!
            return list;
        }

        // If we hit an empty item, don't return it
        if (!URL.length) {
            return list;
        }

        // If we don't support the protocol in question
        if (!crawler.protocolSupported(URL)) {
            return list;
        }

        // Does the item already exist in the list?
        if (list.reduce(function(prev, current) {
            return prev || current === URL;
        }, false)) {
            return list;
        }

        return list.concat(URL);
    }, []);
  function cleanURL (queueItem, URL) {
    return URL
        .replace(/^(?:\s*href|\s*src)\s*=+\s*/i, "")
        .replace(/^\s*/, "")
        .replace(/^url\((.*)\)/i, "$1")
        .replace(/^javascript\:\s*[a-z0-9]+\((.*)/i, "$1")
        .replace(/^(['"])(.*)\1$/, "$2")
        .replace(/^\((.*)\)$/, "$1")
        .replace(/^\/\//, queueItem.protocol + "://")
        .replace(/\&amp;/gi, "&")
        .replace(/\&#38;/gi, "&")
        .replace(/\&#x00026;/gi, "&")
        .split("#")
        .shift()
        .trim();
  }
};


Crawler.prototype.processURL = function(URL, context) {
  var newURL;

  // If the URL didn't contain anything, don't fetch it.
  if (!(URL && URL.replace(/\s+/ig, "").length)) {
      return false;
  }

  try {
    newURL = uri(URL).absoluteTo(context.url).normalize();
  } catch (e) {
    // Couldn't process the URL, since URIjs choked on it.
    return false;
  }

  // simplecrawler uses slightly different terminology to URIjs. Sorry!
  return {
    protocol: newURL.protocol() || "http",
    host:     newURL.hostname(),
    port:     newURL.port() || 80,
    path:     newURL.resource(),
    uriPath:  newURL.path(),
    depth:    context.depth + 1
  };
};


Crawler.prototype.domainValid = function(host) {
  var crawler = this;


  // Checks if the first domain is a subdomain of the second
  function isSubdomainOf(subdomain, host) {


    //remove www from host and subdomain
    // (if www is the first domain component...)
    host = host.replace(/^www./ig, "");
    //remove www first
    subdomain = subdomain.replace(/^www./ig, "");

    // They should be the same flipped around!
    return subdomain.split("").reverse().join("").substr(0, host.length) === host.split("").reverse().join("");
  }

          // If we're not filtering by domain, just return true.
  return !crawler.filterByDomain ||
          // Or if the domain is just the right one, return true.
          host === crawler.host ||
          // Or if we're scanning subdomains, and this domain is a subdomain
          // of the crawler's set domain, return true.
          isSubdomainOf(host, crawler.host);
};


Crawler.prototype.protocolSupported = function(URL) {
  var protocol,
      crawler = this;

  try {
    protocol = uri(URL).protocol();

    // Unspecified protocol. Assume http
    if (!protocol)
      return true;

  } catch (e) {
      // If URIjs died, we definitely /do not/ support the protocol.
    return false;
  }

  return crawler.allowedProtocols.reduce(function(prev, protocolCheck) {
      return prev || !!protocolCheck.exec(protocol);
  }, false);
};


Crawler.prototype.addFetchCondition = function(callback) {
    var crawler = this;
    if (callback instanceof Function) {
        crawler._fetchConditions.push(callback);
        return;
    }
    throw new Error("Fetch Condition must be a function.");
};
module.exports = Crawler;
