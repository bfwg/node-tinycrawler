var a = function(cb) {
  var match = 30;
  new Promise((res, rej) => {
    setTimeout(() => {
      res();
    }, 2000);
  })
  .then(() => {
    for (var i = 0; i < 10; i++) {
      console.log(i, match);
      if (i === match) {
        new Promise((res, rej) => {
          setTimeout(() => {
            cb(null, i);
            res();
          }, 1000);
        });
        break;
      }
      if (i === 10 - 1) {
        cb('error');
      }
    }
  });

}

a((n, i) => {
  if (i)
    console.log('found', i);
  else if (n)
    console.log('not found');

});
