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
        c.on('data', async d=>{
            // just ignore any telnet commands and hope that's ok
            if (d[0] == 255) {
                console.log(`${connId}: IAC: ${d.toString('hex')}`);
                return;
            }
            
            line += d;

            if (state.hideInput) {
                const backspace = new Uint8Array([8]);
                for (let i=0; i<d.length; ++i) {
                    c.write(backspace);
                }
                for (let i=0; i<d.length; ++i) {
                    c.write('*');
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
