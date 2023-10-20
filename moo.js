const mootils = require("./mootils");
// NB. moodb loaded after exports defined to fix circular deps

const listToStr = mootils.listToStr;
const underline = mootils.underline;


class Thing {
    constructor(row, extended) {
        this.id = +row.id;
        this.ownerId = row.ownerId ? +row.ownerId : null;
        this.title = row.title;
        this.description = row.description;
        this.holds = [];
    }

    toExtended() {
        return {};
    }

    initPostLoad() {
    }

    async save() {
        const extended = this.toExtended();
        const row = {
            id: this.id,
            ownerId: this.ownerId,
            title: this.title,
            description: this.description,
            extended: JSON.stringify(extended),
        };

        await moodb.saveThing(row);
    }

    overview() {
        return `${this.title}. Contains ${listToStr(this.holds)}.`;
    }

    describe() {
        return `${this.title}'\n\n'${this.description}. It contains ${listToStr(this.holds)}.`;
    }


    async setDescription(description) {
        this.description = description;

        await this.save();
    }

    async thingAdded(thing) {
        if (this.holds.indexOf(thing) >= 0) {
            return;
        }

        this.holds.push(thing);
        await moodb.addHold(this.id, thing.id);
    }
    async thingRemoved(thing) {
        const ix = this.holds.indexOf(thing);
        if (ix >= 0) {
            this.holds = this.holds.splice(ix, 1);
            await moodb.removeHold(this.id, thing.id);
        }
    }
}


class Place extends Thing {
    constructor(row, extended) {
        super(row, extended);

        this.exitIds = new Map();  // direction -> thingId
        this.exits = new Map();    // direction -> thing
        
        if (extended.exitIds) {
            for (const [dir, id] of extended.exitIds) {
                this.exitIds.set(dir, id);
            }
        }
    }

    toExtended() {
        return {
            ...super.toExtended(),
            exitIds: [...this.exitIds.entries()],
        };
    }
    
    initPostLoad() {
        this.exits = new Map();
        for (const [direction, destId] of this.exitIds.entries()) {
            this.exits.set(direction, moodb.getById(destId));
        }
    }

    async addExit(direction, dest) {
        this.exitIds.set(direction, dest.id);
        this.exits.set(direction, dest);

        await this.save();
    }

    getResidentPlayers() {
        return this.holds.filter(thing => { return thing instanceof Player; });
    }

    overview() {
        return `${this.title}. ${listToStr(this.holds, 'is', 'are')} here.`;
    }

    describe() {
        let desc = this.description.trim();
        if (!desc.endsWith('.')) {
            desc += '.';
        }

        return `${underline(this.title)}${desc} ${this._getExitText()}\n${listToStr(this.holds, 'is', 'are')} here.`;
    }

    _getExitText() {
        const exitNames = [];
        for (const exitName of this.exits.keys()) {
            // heh...
            if (exitName.length > 1) {
                exitNames.push(exitName);
            }
        }
        if (exitNames.length == 0) {
            return `There doesn't appear to be a way out of here.`;
        }
        if (exitNames.length == 1) {
            return `There is an exit ${exitNames[0]}.`;
        }

        return `Exits are via ${listToStr(exitNames)}.`;
    }
}


class Player extends Thing {
    constructor(row, extended) {
        super(row, extended);

        this.locationId = extended.locationId ?? -1;

        this.state = null;
    }

    toExtended() {
        return {
            ...super.toExtended(),
            locationId: this.locationId,
        };
    }

    async travelTo(place) {
        if (this.locationId >= 0) {
            const oldPlace = moodb.getById(this.locationId);
            await oldPlace.thingRemoved(this);
        }

        this.locationId = place.id;
        await place.thingAdded(this);
        await this.save();
    }
};



const thingTypes = {
    'Thing' : Thing,
    'Place' : Place,
    'Player' : Player,
};


// deserialises a thing from the db
const thingFactory = row => {
    const cls = row.class_;

    const extendedJson = row.data ?? "{}";
    const extended = JSON.parse(extendedJson);

    if (cls in thingTypes) {
        const thing = new thingTypes[cls](row, extended);

        if (moodb.dbReady) {
            thing.initPostLoad();
        }

        return thing;
    }

    console.error(`unable to create a Thing for row ${JSON.stringify(row)}`);
};




module.exports = {
    Thing,
    Place,
    Player,

    thingFactory,
};

const moodb = require('./moodb')
