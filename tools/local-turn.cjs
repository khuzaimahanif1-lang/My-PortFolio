// Development relay: loopback only, authenticated, bounded UDP allocation ports.
// Use a maintained TURN service such as coturn for public deployment.
const fs=require('node:fs');const path=require('node:path');const Turn=require('node-turn');
const envPath=path.join(__dirname,'../Backend/.env');
const env=Object.fromEntries(fs.readFileSync(envPath,'utf8').split(/\r?\n/).filter(line=>line&&!line.trim().startsWith('#')).map(line=>{const n=line.indexOf('=');return [line.slice(0,n),line.slice(n+1).trim().replace(/^['"]|['"]$/g,'')];}));
const username=env.WEBRTC_TURN_USERNAME,password=env.WEBRTC_TURN_PASSWORD;
if(!username||!password||!env.WEBRTC_TURN_URL?.includes('127.0.0.1:3478'))throw new Error('Set a localhost TURN URL and credentials in Backend/.env first.');
const server=new Turn({listeningIps:['127.0.0.1'],relayIps:['127.0.0.1'],listeningPort:3478,minPort:35000,maxPort:35100,authMech:'long-term',credentials:{[username]:password},realm:'king-ai-local',debugLevel:'OFF'});
server.start();console.log('Authenticated development TURN relay on 127.0.0.1:3478.');
function stop(){server.stop();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
