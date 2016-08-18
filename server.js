import http from 'http';
import finalHandler from 'finalhandler';
import serveStatic from 'serve-static';

var serve = serveStatic("dist");

http.createServer((req, res) => {
  var done = finalHandler(req, res);
  serve(req, res, done);
}).listen(8080);
