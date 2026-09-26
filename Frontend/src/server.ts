import { AngularNodeAppEngine, createNodeRequestHandler, isMainModule, writeResponseToNodeResponse } from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import http from 'node:http';
import https from 'node:https';

const browserDistFolder=join(import.meta.dirname,'../browser');
const app=express();
const angularApp=new AngularNodeAppEngine({allowedHosts:(process.env['SSR_ALLOWED_HOSTS']||'localhost,127.0.0.1').split(',').map(host=>host.trim()).filter(Boolean)});
const apiUrl=new URL(process.env['API_URL']||'http://127.0.0.1:8000');
const upstreamRequest=apiUrl.protocol==='https:'?https.request:http.request;

// Keep cookies, bearer headers and image bytes on one origin in production.
app.use('/api',(req,res)=>{
  const upstream=upstreamRequest(new URL(req.originalUrl,apiUrl),{method:req.method,headers:{...req.headers,host:apiUrl.host}},response=>{
    res.writeHead(response.statusCode||502,response.headers);response.pipe(res);
  });
  upstream.setTimeout(30000,()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)res.status(502).json({detail:'The workspace server is unavailable.'});else res.end();});
  req.pipe(upstream);
});
app.use(express.static(browserDistFolder,{maxAge:'1y',index:false,redirect:false}));
app.use((req,res,next)=>{angularApp.handle(req).then(response=>response?writeResponseToNodeResponse(response,res):next()).catch(next);});
if(isMainModule(import.meta.url)||process.env['pm_id']){
  const port=process.env['PORT']||4000;
  const server=app.listen(port,()=>console.log('King AI is available at http://localhost:'+port));
  server.on('upgrade',(req,socket,head)=>{
    if(!req.url?.startsWith('/api/ws?')){socket.destroy();return;}
    const upstream=upstreamRequest(new URL(req.url,apiUrl),{method:'GET',headers:{...req.headers,host:apiUrl.host}});
    upstream.on('upgrade',(response,remote,remoteHead)=>{
      const headers=Object.entries(response.headers).map(([name,value])=>name+': '+(Array.isArray(value)?value.join(', '):value)).join('\r\n');
      socket.write('HTTP/1.1 101 Switching Protocols\r\n'+headers+'\r\n\r\n');
      if(head.length)remote.write(head);if(remoteHead.length)socket.write(remoteHead);
      socket.pipe(remote);remote.pipe(socket);
      socket.on('error',()=>remote.destroy());remote.on('error',()=>socket.destroy());
      socket.on('close',()=>remote.destroy());remote.on('close',()=>socket.destroy());
    });
    upstream.on('response',response=>{socket.end('HTTP/1.1 '+(response.statusCode||502)+' Rejected\r\nConnection: close\r\n\r\n');response.resume();});
    upstream.on('error',()=>socket.destroy());upstream.end();
  });
}
export const reqHandler=createNodeRequestHandler(app);
