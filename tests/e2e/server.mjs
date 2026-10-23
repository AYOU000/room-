import { createServer } from 'node:http';
createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>ROOM audio infrastructure fixture</title>');}).listen(4174,'127.0.0.1');
