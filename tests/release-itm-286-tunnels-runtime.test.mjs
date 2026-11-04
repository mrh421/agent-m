// Module: MOD-tunnels
// Independent public runtime release coverage for MOD-tunnels (ITM-286).
//
// This file uses a controlled ssh2@1.17.0 loopback server and temporary data only.
// It neither starts a desktop shell nor contacts a system or external SSH server.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

const source = new URL("../src/tunnels/index.mjs", import.meta.url).href;
const bridgeHttp = new URL("../src/bridge-http/index.mjs", import.meta.url).href;
const ssh2Cache = join(tmpdir(), "agent-m-286-release-ssh2-1.17.0");

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, { encoding: "utf8", timeout: 40_000, ...options });
  if (result.status !== 0) throw new Error(`${command} ${arguments_.join(" ")} failed; status=${result.status}; signal=${result.signal}; error=${result.error?.code ?? "none"}; stderr=${result.stderr}`);
  return result;
}

function dependency() {
  const nodePath = ssh2NodePath(ssh2Cache);
  const fixture = run(process.execPath, ["--input-type=module", "-e", `
    import { createRequire } from "node:module";
    const require=createRequire(new URL("../bridge-build/package.json", ${JSON.stringify(source)})),crypto=require("node:crypto"),fixturePrivateKey=crypto.createPrivateKey({key:{kty:"OKP",crv:"Ed25519",d:Buffer.from("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60","hex").toString("base64url"),x:Buffer.from("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a","hex").toString("base64url")},format:"jwk"}),fixturePublicKey=crypto.createPublicKey(fixturePrivateKey),ordinary=crypto.generateKeyPairSync;
    if(fixturePublicKey.export({type:"spki",format:"der"}).at(-32)===0)throw Error("fixture leading-zero public byte");crypto.generateKeyPairSync=(type,options)=>{if(type!=="ed25519")throw Error("fixture key type");return {privateKey:fixturePrivateKey.export(options.privateKeyEncoding),publicKey:fixturePublicKey.export(options.publicKeyEncoding)}};
    let pair;try{const {utils}=require("ssh2");if(require("ssh2/package.json").version!=="1.17.0")throw Error("ssh2 version");pair=utils.generateKeyPairSync("ed25519");const privateKey=utils.parseKey(pair.private),publicKey=utils.parseKey(pair.public);if(privateKey instanceof Error||publicKey instanceof Error||privateKey.type!=="ssh-ed25519"||privateKey.getPublicSSH().compare(publicKey.getPublicSSH())!==0)throw Error("pinned converter/parser positive")}finally{crypto.generateKeyPairSync=ordinary}console.log(JSON.stringify(pair));
  `], { env: { ...process.env, NODE_PATH: nodePath } });
  const positive = run(process.execPath, ["--input-type=module", "-e", `
    import { createRequire } from "node:module";
    const require=createRequire(new URL("../bridge-build/package.json", ${JSON.stringify(source)})),{Client,Server,utils}=require("ssh2");if(require("ssh2/package.json").version!=="1.17.0")throw Error("ssh2 version");const server=new Server({hostKeys:[utils.generateKeyPairSync("rsa",{bits:2048}).private]},client=>client.on("authentication",context=>context.accept()));await new Promise((ok,no)=>server.listen(0,"127.0.0.1",error=>error?no(error):ok()));const client=new Client();await new Promise((ok,no)=>client.once("ready",ok).once("error",no).connect({host:"127.0.0.1",port:server.address().port,username:"fixture",password:"fixture",hostVerifier:()=>true}));const closed=new Promise(ok=>client.once("close",ok));client.end();await closed;await new Promise(ok=>server.close(ok));console.log("ssh2-release-loopback-positive");
  `], { env: { ...process.env, NODE_PATH: nodePath } });
  assert.match(positive.stdout, /ssh2-release-loopback-positive/);
  return { nodePath, fixture: JSON.parse(fixture.stdout) };
}

function worker(script, folder) {
  const runtime = dependency();
  return spawnSync(process.execPath, ["--input-type=module", "-e", script, folder, JSON.stringify(runtime.fixture)], { encoding: "utf8", timeout: 40_000, env: { ...process.env, NODE_PATH: runtime.nodePath } });
}

function dataFolder() { return mkdtempSync(join(tmpdir(), "agent-m-286-release-")); }

// TST-286901
// level: release
// module: MOD-tunnels
// guards: THE BRIDGE CREATES ITS OWN SSH KEY; UC-044
// given: the pinned ssh2 converter and parser establish a real deterministic Ed25519 positive before a fresh private Bridge folder
// input: public ensureKey creates the folder's key and closeTunnels follows with no active plans
// expect: the persisted private and public bytes parse as one matching ssh-ed25519 pair, carry the returned fingerprint, and state remains empty
test("TST-286901: public ensureKey persists a real matching Ed25519 pair in a fresh private folder", () => {
  const folder = dataFolder();
  const script = `
    import { createRequire } from "node:module"; import {readFileSync} from "node:fs";
    const require=createRequire(new URL("../bridge-build/package.json", ${JSON.stringify(source)})),{utils}=require("ssh2"); const {ensureKey,closeTunnels,tunnelState}=await import(${JSON.stringify(source)});
    const result=await ensureKey(process.argv[1]),privateBytes=readFileSync(process.argv[1]+"/ssh/id_ed25519"),publicBytes=readFileSync(process.argv[1]+"/ssh/id_ed25519.pub"),privateKey=utils.parseKey(privateBytes),publicKey=utils.parseKey(publicBytes);
    await closeTunnels(); if(privateKey instanceof Error||publicKey instanceof Error||privateKey.type!=="ssh-ed25519"||privateKey.getPublicSSH().compare(publicKey.getPublicSSH())!==0||!result.fingerprint||tunnelState().length!==0)throw Error("ensure-key-runtime-positive"); console.log("ensure-key-runtime-positive");
  `;
  try {
    const result = worker(script, folder);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /ensure-key-runtime-positive/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-286902
// level: release
// module: MOD-tunnels
// guards: THE BRIDGE OPENS ITS TUNNELS ITSELF; A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK; UC-044
// given: a pinned converter/parser positive, a stable real Ed25519 private folder, an authenticated ssh2 jump host, and a loopback Bridge echo server
// input: public openTunnels receives one canonical reverse TunnelPlan, bytes arrive at its forwarded listener, and the authenticated public tunnel handler is requested
// expect: the reverse listener delivers the exact bytes, the public handler reports its exact open state, and public closeTunnels clears that state
test("TST-286902: reverse runtime bytes and the authenticated public state handler share the actual open tunnel", () => {
  const folder = dataFolder();
  const script = `
    import {createRequire} from "node:module";import {mkdirSync,writeFileSync} from "node:fs";import net from "node:net";
    const require=createRequire(new URL("../bridge-build/package.json", ${JSON.stringify(source)})),{Server,utils}=require("ssh2"),{openTunnels,closeTunnels,tunnelState,tunnelHandlers}=await import(${JSON.stringify(source)}),{bridgeApi,serveBridge}=await import(${JSON.stringify(bridgeHttp)});
    const listen=s=>new Promise((ok,no)=>s.listen(0,"127.0.0.1",e=>e?no(e):ok(s.address().port))),pause=ms=>new Promise(ok=>setTimeout(ok,ms));
    const fixture=JSON.parse(process.argv[2]);mkdirSync(process.argv[1]+"/ssh",{recursive:true});writeFileSync(process.argv[1]+"/ssh/id_ed25519",fixture.private);writeFileSync(process.argv[1]+"/ssh/id_ed25519.pub",fixture.public);
    const bridgeEcho=net.createServer(socket=>socket.pipe(socket)),bridgePort=await listen(bridgeEcho);let remote;const ssh=new Server({hostKeys:[utils.generateKeyPairSync("rsa",{bits:2048}).private]},client=>{client.on("error",()=>{});client.on("authentication",context=>context.accept());client.on("request",async(accept,reject,name,info)=>{if(name!=="tcpip-forward")return reject();remote=net.createServer(socket=>client.forwardOut(info.bindAddr,info.bindPort,socket.remoteAddress,socket.remotePort,(error,stream)=>error?socket.destroy(error):socket.pipe(stream).pipe(socket)));await new Promise((ok,no)=>remote.listen(info.bindPort,info.bindAddr,e=>e?no(e):ok()));accept();});});const sshPort=await listen(ssh),reservation=net.createServer(),remotePort=await listen(reservation);await new Promise(ok=>reservation.close(ok));
    const plan={direction:"reverse",jumpHost:"127.0.0.1",user:"fixture",sshPort,remotePort,bind:"127.0.0.1",bridgePort};await openTunnels(process.argv[1],[plan],bridgePort);for(let i=0;i<80&&tunnelState()[0]?.state!=="open";i++)await pause(10);if(tunnelState()[0]?.state!=="open")throw Error(JSON.stringify(tunnelState()));
    const bytes=await new Promise((ok,no)=>{const socket=net.connect(remotePort,"127.0.0.1");socket.once("error",no);socket.once("data",value=>{ok(value.toString());socket.destroy();});socket.write("release-reverse-bytes");});
    const bridge=await serveBridge({host:"127.0.0.1",port:0,origin:"https://release-owner.github.io",dataFolder:process.argv[1],paused:()=>false},{jobs:{},mail:{},tunnels:tunnelHandlers});const response=await fetch(bridge.address+"/v1/tunnels",{headers:{Origin:"https://release-owner.github.io",[bridgeApi.tokenHeader]:bridge.token}}),body=await response.json();await bridge.close();await closeTunnels();await new Promise(ok=>remote.close(ok));await new Promise(ok=>ssh.close(ok));await new Promise(ok=>bridgeEcho.close(ok));if(bytes!=="release-reverse-bytes"||response.status!==200||JSON.stringify(body)!==JSON.stringify({tunnels:[{name:"reverse:127.0.0.1:"+remotePort,kind:"reverse",state:"open",reason:null}]})||tunnelState().length!==0)throw Error(JSON.stringify({bytes,status:response.status,body,state:tunnelState()}));console.log("release-reverse-handler-positive");
  `;
  try {
    const result = worker(script, folder);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /release-reverse-handler-positive/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-286903
// level: release
// module: MOD-tunnels
// guards: A REVERSE TUNNEL LISTENS ONLY ON THE JUMP HOST'S LOOPBACK; THE BRIDGE OPENS ITS TUNNELS ITSELF; UC-011; UC-044
// given: a pinned converter/parser positive, a stable real Ed25519 private folder, and controlled ssh2 hosts whose accepted key later changes
// input: public openTunnels receives a canonical forward plan, then a non-loopback plan and the same plan after its trusted host key rotates
// expect: forward bytes round-trip, the actual Client connect option has the 30000ms keepalive, non-loopback refuses before transport, and changed host keys refuse before forwarding
test("TST-286903: forward runtime keeps loopback, host-key, and keepalive boundaries while carrying bytes", () => {
  const folder = dataFolder();
  const script = `
    import {createRequire} from "node:module";import {mkdirSync,writeFileSync} from "node:fs";import net from "node:net";
    const require=createRequire(new URL("../bridge-build/package.json", ${JSON.stringify(source)})),ssh2=require("ssh2"),{Server,utils,Client}=ssh2,{openTunnels,closeTunnels,tunnelState}=await import(${JSON.stringify(source)});const listen=s=>new Promise((ok,no)=>s.listen(0,"127.0.0.1",e=>e?no(e):ok(s.address().port))),pause=ms=>new Promise(ok=>setTimeout(ok,ms));
    const fixture=JSON.parse(process.argv[2]);mkdirSync(process.argv[1]+"/ssh",{recursive:true});writeFileSync(process.argv[1]+"/ssh/id_ed25519",fixture.private);writeFileSync(process.argv[1]+"/ssh/id_ed25519.pub",fixture.public);const echo=net.createServer(socket=>socket.pipe(socket)),echoPort=await listen(echo),reserve=net.createServer(),localPort=await listen(reserve);await new Promise(ok=>reserve.close(ok));let requests=0,keepalive;const original=Client.prototype.connect;Client.prototype.connect=function(options){keepalive=options.keepaliveInterval;return original.call(this,options)};
    const key1=utils.generateKeyPairSync("rsa",{bits:2048}).private,key2=utils.generateKeyPairSync("rsa",{bits:2048}).private,host=key=>new Server({hostKeys:[key]},client=>{client.on("error",()=>{});client.on("authentication",context=>context.accept());client.on("tcpip",(accept,reject,info)=>{requests++;if(info.destIP!=="127.0.0.1"||info.destPort!==localPort)return reject();const stream=accept(),socket=net.connect(echoPort,"127.0.0.1");socket.pipe(stream).pipe(socket);});});let ssh=host(key1);const sshPort=await listen(ssh),plan={direction:"forward",jumpHost:"127.0.0.1",user:"fixture",sshPort,remotePort:localPort,bind:"127.0.0.1",bridgePort:echoPort};
    await openTunnels(process.argv[1],[plan],echoPort);for(let i=0;i<80&&tunnelState()[0]?.state!=="open";i++)await pause(10);const bytes=await new Promise((ok,no)=>{const socket=net.connect(localPort,"127.0.0.1");socket.once("error",no);socket.once("data",value=>{ok(value.toString());socket.destroy()});socket.write("release-forward-bytes")});await closeTunnels();
    let nonLoopback;try{await openTunnels(process.argv[1],[{...plan,bind:"0.0.0.0"}],echoPort)}catch(error){nonLoopback=error}await new Promise(ok=>ssh.close(ok));ssh=host(key2);await new Promise((ok,no)=>ssh.listen(sshPort,"127.0.0.1",e=>e?no(e):ok()));requests=0;await openTunnels(process.argv[1],[plan],echoPort);await pause(160);const changed=tunnelState()[0];await closeTunnels();Client.prototype.connect=original;await new Promise(ok=>ssh.close(ok));await new Promise(ok=>echo.close(ok));if(bytes!=="release-forward-bytes"||keepalive!==30000||!String(nonLoopback).includes("NotLoopback")||changed?.reason!=="host-key-changed"||requests!==0)throw Error(JSON.stringify({bytes,keepalive,nonLoopback:String(nonLoopback),changed,requests}));console.log("release-forward-boundaries-positive");
  `;
  try {
    const result = worker(script, folder);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /release-forward-boundaries-positive/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

// TST-286904
// level: release
// module: MOD-tunnels
// guards: THE BRIDGE OPENS ITS TUNNELS ITSELF; UC-011; UC-044
// given: a pinned converter/parser positive, a stable real Ed25519 private folder, one ssh2 host refusing authentication, one closed loopback port, and one host closing accepted reverse sessions
// input: public openTunnels starts all canonical plans, waits until the asserted states are reached, measures each reconnect wait from the cycling host closing one connection to accepting the next, then public closeTunnels runs before another wait can fire
// expect: authentication and unreachable states retain independent reasons, reconnect waits grow, and close leaves no active state or later connection attempt
test("TST-286904: public runtime isolates failures, grows reconnect waits, and stops reconnecting after close", () => {
  const folder = dataFolder();
  const script = `
    import {createRequire} from "node:module";import {mkdirSync,writeFileSync} from "node:fs";import net from "node:net";
    const require=createRequire(new URL("../bridge-build/package.json", ${JSON.stringify(source)})),{Server,utils}=require("ssh2"),{openTunnels,closeTunnels,tunnelState}=await import(${JSON.stringify(source)});const listen=s=>new Promise((ok,no)=>s.listen(0,"127.0.0.1",e=>e?no(e):ok(s.address().port))),pause=ms=>new Promise(ok=>setTimeout(ok,ms));
    const fixture=JSON.parse(process.argv[2]);mkdirSync(process.argv[1]+"/ssh",{recursive:true});writeFileSync(process.argv[1]+"/ssh/id_ed25519",fixture.private);writeFileSync(process.argv[1]+"/ssh/id_ed25519.pub",fixture.public);const key=utils.generateKeyPairSync("rsa",{bits:2048}).private,denied=new Server({hostKeys:[key]},client=>{client.on("error",()=>{});client.on("authentication",context=>context.reject())}),deniedPort=await listen(denied),reserved=net.createServer(),unreachablePort=await listen(reserved);await new Promise(ok=>reserved.close(ok));let attempts=0;const conns=[],cycling=new Server({hostKeys:[key]},client=>{const conn={opened:Date.now(),closed:null};conns.push(conn);client.on("close",()=>{conn.closed=Date.now()});client.on("error",()=>{});client.on("authentication",context=>context.accept());client.on("request",(accept,reject,name)=>{if(name!=="tcpip-forward")return reject();attempts++;accept();setTimeout(()=>client.end(),10);});}),cyclingPort=await listen(cycling),plan=(sshPort,remotePort)=>({direction:"reverse",jumpHost:"127.0.0.1",user:"fixture",sshPort,remotePort,bind:"127.0.0.1",bridgePort:1});
    await openTunnels(process.argv[1],[plan(deniedPort,45241),plan(unreachablePort,45242),plan(cyclingPort,45243)],1);const reached=()=>{const state=tunnelState();return state.some(value=>value.name==="reverse:127.0.0.1:45241"&&value.reason==="auth-refused")&&state.some(value=>value.name==="reverse:127.0.0.1:45242"&&value.reason==="host-unreachable")&&attempts>=4&&conns.length>=4&&conns.slice(0,3).every(conn=>conn.closed!==null)},limit=Date.now()+15000;while(!reached()){if(Date.now()>limit)throw Error("asserted states not reached in 15000ms: "+JSON.stringify({state:tunnelState(),attempts,connections:conns}));await pause(10)}const state=tunnelState(),deniedState=state.find(value=>value.name==="reverse:127.0.0.1:45241"),unreachableState=state.find(value=>value.name==="reverse:127.0.0.1:45242"),waits=[1,2,3].map(index=>conns[index].opened-conns[index-1].closed);const before=attempts;await closeTunnels();await pause(350);const after=attempts;await new Promise(ok=>cycling.close(ok));await new Promise(ok=>denied.close(ok));if(deniedState?.reason!=="auth-refused"||unreachableState?.reason!=="host-unreachable"||waits[0]<80||waits[1]<180||!(waits[2]>=1.5*waits[1])||tunnelState().length!==0||after!==before)throw Error(JSON.stringify({deniedState,unreachableState,waits,before,after,state:tunnelState()}));console.log("release-reconnect-positive",JSON.stringify(waits));
  `;
  try {
    const result = worker(script, folder);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /release-reconnect-positive/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
