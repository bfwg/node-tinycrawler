
var t = new Promise(res => {
  res(1);
})
.then((res) => {
  console.log(res + 'aaa');
});

console.log(t);
