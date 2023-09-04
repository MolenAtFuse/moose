const mootils = require("./mootils");
// NB. moodb loaded after exports defined to fix circular deps

const NL = mootils.NL;
const NL2 = mootils.NL2;
const listToStr = mootils.listToStr;


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
    loadExtended(data) {
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
        return `${this.title}${NL2}${this.description}. It contains ${listToStr(this.holds)}.`;
    }

    async thingAdded(thing) {
        this.holds.push(thing);
        await moodb.addHold(this.id, thing.id);
    }
    async thingRemoved(thing) {
        const ix = this.holds.indexOf(thing);
        if (ix >= 0) {
            this.holds = this.holds.splice(ix, 1);
        }
        await moodb.removeHold(this.id, thing.id);
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

    overview() {
        return `${this.title}. ${listToStr(this.holds, 'is', 'are')} here.`;
    }

    describe() {
        return `${this.title}${NL2}${this.description}${NL2}${listToStr(this.holds, 'is', 'are')} here.`;
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
