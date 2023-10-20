const express = require('express');
const http = require('http');
const net = require('node:net');
const ws = require('ws');

const moodb = require('./moodb');
const mooser = require('./mooser');
const { clearInterval } = require('timers');
const LoginFlow = require('./flows/loginflow').LoginFlow;

const WEBPORT = 8001;
const TELNETPORT = 8889;

const WelcomeMsg =  `
-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-

              welcome to MOOse
          please tip your servers

   local time now is ... past your bedtime

-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\n\n`;



class WebSocketConnection {
    constructor(ws) {
        this.ws = ws;
    }

    sendText(txt) {
        this.ws.send(txt);
    }

    // legacy!
    write(txt) {
        this.sendText(txt);
    }
}

class TelnetConnection {
    constructor(c) {
        this.c = c;
    }

    sendText(txt) {
        this.c.write(txt.replaceAll('\n', '\r\n'));
    }

    // legacy!
    write(txt) {
        this.sendText(txt);
    }
};



const attachWsServer = (server) => {
    const wss = new ws.WebSocketServer({ clientTracking: false, noServer: true });

    server.on('upgrade', (req, socket, head) => {
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (ws, req) => {
        const connId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
        console.log(`client connected: ${connId}`);
        
        const conn = new WebSocketConnection(ws);
        conn.write(WelcomeMsg);
        
        const state = { conn, connId };
        let flow = new LoginFlow(conn, state);
          
        ws.on('message', async (msg) => {
            const line = msg.toString().trim();

            conn.sendText((state.hideInput ? '********' : line) + `\n`);
            
            console.log(`${connId}/${state.username}: '${line}'`);
            if (flow) {
                const newFlow = await flow.processInput(line, conn, state);
                if (newFlow) {
                    console.log(`${connId}/${state.username}: switching flow to ${newFlow.constructor.name}`);
                    flow = newFlow;
                }
            }
        });

        // detect dropped socks
        let isAlive = true;
        ws.on('pong', () => { isAlive = true; });
        const watchdog = setInterval(() => {
            if (!isAlive) {
                console.log(`watchdog detected ${connId}/${state.username} dropped`);
                return ws.terminate();
            }
            isAlive = false;
            ws.ping();
        }, 30*1000);

        ws.on('close', () => {
            console.log(`client disconnected: ${connId} (${state.username})`);
            mooser.onUserLoggedOut(state.player);
            clearInterval(watchdog);
        });

        ws.on('error', console.error);
    });

    wss.on('error', err=> {
        throw err;
    });

    console.log(`websocket server ready`);
};



const runWebServer = (port) => {
    const app = express();
    app.use(express.static('www/public'));
    console.log(`webserver listening on port ${port}`);

    const server = http.createServer(app);
    attachWsServer(server);
    server.listen(port);
};


const runTelnetServer = (port) => {
    const BACKSPACE = 8;

    const server = net.createServer((c) => {
        const connId = `${c.remoteAddress}:${c.remotePort}`;
        console.log(`client connected: ${connId}`);
        const conn = new TelnetConnection(c);

        conn.write(WelcomeMsg);

        const state = { conn, connId };
        let flow = new LoginFlow(conn, state);

        let line = '';

        c.on('end', () => {
            console.log(`client disconnected: ${connId} (${state.username})`);
            mooser.onUserLoggedOut(state.player);
        });
        c.on('data', async data=>{
            // just ignore any telnet commands and hope that's ok
            if (data[0] == 255) {
                console.log(`${connId}: IAC: ${[...data].join(',')}`);
                return;
            }
            
            // implement backspace
            for (const c of data) {
                if (c == BACKSPACE) {
                    if (line.length > 0) {
                        line = line.substring(0, line.length-1);
                    }
                }
                else {
                    line += String.fromCharCode([c]);
                }
            }

            if (state.hideInput) {
                const backspace = new Uint8Array([BACKSPACE]);
                for (let i=0; i<data.length; ++i) {
                    c.write(backspace);
                }
                for (let i=0; i<data.length; ++i) {
                    if (data[i] != 10 && data[i] != 13) {     // ignore CR & LF
                        c.write('*');
                    }
                }
            }

            // TODO: handle d containing multiple lines
            if (line.endsWith('\n')) {
                line = line.trim();
                
                // ignore escape sequences
                line = line.replace(/[\x1b][[]./g, '');
                
                //console.log(`${connId}: '${line}'`);
                if (flow) {
                    const newFlow = await flow.processInput(line, conn, state);
                    if (newFlow) {
                        console.log(`${connId}: switching flow to ${newFlow.constructor.name}`);
                        flow = newFlow;
                    }
                }

                line = '';
            }
        });
    });

    server.on('error', err=> {
        throw err;
    });

    server.listen(port, () => {
        console.log(`server listening on port ${port}`);
    });
};


const main = async () => {
    await moodb.init();

    runWebServer(WEBPORT);
    runTelnetServer(TELNETPORT);
};



main();
