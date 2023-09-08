const net = require('node:net');

const moodb = require('./moodb');
const LoginFlow = require('./flows/loginflow').LoginFlow;

const PORT = 8889;

const WelcomeMsg =  '' +
'-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\r\n' +
'\r\n' +
'          welcome to MOOse\r\n' +
'       please tip your servers\r\n' +
'\r\n' +
'local time now is ... past your bedtime\r\n' +
'\r\n' +
'-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-\r\n\r\n';


const BACKSPACE = 8;


const runServer = () => {
    const server = net.createServer((c) => {
        const connId = `${c.remoteAddress}:${c.remotePort}`;
        console.log(`client connected: ${connId}`);
        c.write(WelcomeMsg);

        const state = { conn:c, connId };
        let flow = new LoginFlow(c, state);

        let line = '';

        c.on('end', () => {
            console.log(`client disconnected: ${connId}`);
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
                for (let i=0; i<d.length; ++i) {
                    c.write(backspace);
                }
                for (let i=0; i<d.length; ++i) {
                    if (d[i] != 10 && d[i] != 13) {     // ignore CR & LF
                        c.write('*');
                    }
                }
            }

            // TODO: handle d containing multiple lines
            if (line.endsWith('\n')) {
                line = line.trim();
                
                //console.log(`${connId}: '${line}'`);
                if (flow) {
                    const newFlow = await flow.processInput(line, c, state);
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

    server.listen(PORT, () => {
        console.log(`server listening on port ${PORT}`);
    });
};


const main = async () => {
    await moodb.init();

    runServer();
};



main();
