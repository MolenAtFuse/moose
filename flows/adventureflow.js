const moodb = require('../moodb');
const moo = require('../moo');


// thanks stackoverflow: https://stackoverflow.com/a/18647776
const tokenise = input => {
    const tokenRe = /[^\s"]+|"([^"]*)"/g;
    const tokens = [];

    for (;;) {
        const match = tokenRe.exec(input);
        if (!match) {
            break;
        }

        //Index 1 in the array is the captured group if it exists
        //Index 0 is the matched text, which we use if no captured group exists
        tokens.push(match[1] ? match[1] : match[0]);
    }

    return tokens;
};


const eatOptional = (optional, tokens) => {
    if (tokens.length == 0) {
        return;
    }
    
    if (tokens[0].toLowerCase() === optional.toLowerCase()) {
        tokens.shift();
    }
};


const parseCommand = (tokens, pattern) => {
    const ogtokens = [...tokens];

    const patToks = tokenise(pattern);
    const parsed = {};

    while (patToks.length > 0) {
        let ptok = patToks.shift();

        if (tokens.length == 0 && !ptok.startsWith('?')) {
            throw new Error('not enough words');
        }

        // if this token has an ellipsis, gobble the rest of the tokens into a single string
        if (ptok.endsWith('...')) {
            ptok = ptok.replace(/[.]*$/, '');
            const rest = tokens.join(' ');
            tokens = [rest];
        }

        const intok = tokens.shift();

        if (ptok.startsWith('$')) {
            parsed[ptok.substring(1)] = intok;
        }
        else if (ptok.startsWith('?')) {
            const tokName = ptok.substring(1);
            const matches = (intok == tokName);
            parsed[tokName] = matches;

            if (!matches) {
                tokens.unshift(intok);
            }
        }
        else {
            if (intok != ptok) {
                throw new Error(`expected '${ptok}' but you said '${intok}'`);
            }
        }
    }

    console.log(`[parser] interpreted ${ogtokens.join('|')} into ${JSON.stringify(parsed)} using '${pattern}'`);

    return parsed;
};


const arrivedAtLocation = (location, state) => {
    state.currLocation = location;
    state.conn.write('\n' + location.describe() + '\n\n');
};

const moveToPlace = async (place, state) => {
    console.log(`${state.username} moving to ${place.title}, id ${place.id}`);
    await state.player.travelTo(place);
    arrivedAtLocation(place, state);
};

const moveInDirection = async (dir, state) => {
    if (state.currLocation.exits.has(dir)) {
        const newPlace = state.currLocation.exits.get(dir);
        await moveToPlace(newPlace, state);
    }
    else {
        throw new Error(`there isn't an exit '${dir}`);
    }
};


const infoCommands = {
    'look': async (tokens, state) => {
        eatOptional('at', tokens);

        state.conn.write('\n' + state.currLocation.describe() + '\n\n');
    },

    'help': async (tokens, state) => {
        state.conn.write(`available commands:\n`);
        for (const cmdName of Object.keys(allCommands)) {
            state.conn.write(`   ${cmdName}\n`);
        }
    },

    
    'go': async (tokens, state) => {
        await moveInDirection(tokens[0], state);
    },
    'move': async (tokens, state) => {
        await moveInDirection(tokens[0], state);
    },


    'shout': async (tokens, state) => {
        const message = tokens.join(' ');
        throw new Error(`molen hasn't implemented this yet`);
    },
};

const buildingCommands = {

    // @dig e,east[|w,west,out] to "Empty Cupboard"
    '@dig': async (tokens, state) => {
        const cmd = parseCommand(tokens, '$directions to $destination...');
                
        const exitsAndReturns = cmd.directions.split('|', 2);
        const exits = exitsAndReturns[0].split(',');
        const returns = (exitsAndReturns.length > 1) ? exitsAndReturns[1].split(',') : [];

        // check for no dupe exits
        const here = state.currLocation;
        for (const dir of exits) {
            if (here.exits.has(dir)) {
                throw new Error(`this room already has an exit from '${dir}'`);
            }
        }

        // TODO: check for existing destination place ID and just connect to that

        const there = await moodb.newThing('Place', cmd.destination, `The mist here is so thick you can't see anything`, state);

        for (const dir of exits) {
            await here.addExit(dir, there);
        }
        for (const dir of returns) {
            await there.addExit(dir, here);
        }
    },

    // @describe here as "A lovely place to stop awhile."
    '@describe': async (tokens, state) => {
        const cmd = parseCommand(tokens, '$thing as $description...');

        if (cmd.thing.toLowerCase() !== 'here') {
            throw new Error(`i don't know what a ${cmd.thing} is`);
        }

        await state.currLocation.setDescription(cmd.description);
    },

    // @teleport to id
    '@teleport': async (tokens, state) => {
        const cmd = parseCommand(tokens, 'to $dest...');

        const destId = parseInt(cmd.dest);
        if (!isNaN(destId)) {
            const newPlace = moodb.getById(destId);
            if (!newPlace) {
                throw new Error(`we don't seem to have anywhere with that id`)
            }
            if (!(newPlace instanceof moo.Place)) {
                throw new Error(`${newPlace.title} isn't a place`);
            }

            await moveToPlace(newPlace, state);
        }
        else {

        }
    },
};


const adminCommands = {

    '@@ls': async (tokens, state) => {
        moodb.forAllThings(thing => {
            state.conn.write(`${thing.id}\t${thing.constructor.name}\t${thing.title}\n`);
        });
    },

    '@@users': async (tokens, state) => {
        await moodb.forAllUsers((id, username) => {
            state.conn.write(`${id}\t${username}\n`);
        });
    },

    '@@nix': async (tokens, state) => {
        if (state.player.id !== 1) {
            throw new Error(`you don't have permissions to nix things!`);
        }
        const cmd = parseCommand(tokens, '$id $title');
        const thing = moodb.getById(cmd.id);
        if (typeof thing === 'undefined') {
            throw new Error(`we don't have a thing id ${cmd.id}`);
        }
        if (thing.title !== cmd.title) {
            throw new Error(`thing id ${cmd.id} has mismatched title '${thing.title}'`);
        }
        console.log(state);
        await moodb.nixThing(cmd.id, state);
    },

};


const allCommands = {
    ...adminCommands,
    ...infoCommands,
    ...buildingCommands,
};


class AdventureFlow {
    constructor (conn, state) {
        state.hideInput = false;
        conn.write(` adventure time\n`)
        conn.write(`****************\n`)

        arrivedAtLocation(moodb.getById(state.player.locationId), state);
        state.conn.write('> ');
    }

    async processInput(input, conn, state) {
        const tokens = tokenise(input.trim());
        //console.log(tokens);

        if (tokens.length > 0) {
            const command = tokens.shift();
            if (typeof allCommands[command] !== 'undefined') {
                try {
                    await allCommands[command](tokens, state);
                }
                catch (err) {
                    console.log(err);
                    conn.write(`i didn't quite understand that ("${err.message}")\n`);
                }
            }
            else if (state.currLocation.exits.has(command)) {
                await moveInDirection(command, state);
            }
            else {
                conn.write(`i'm afraid i don't know how to ${input}\n`);
            }
        }

        conn.write(`> `);
    }
}



module.exports = {
    AdventureFlow,
};
