const mootils = require("./mootils");
// NB. moodb loaded after exports defined to fix circular deps

const NL = mootils.NL;
const NL2 = mootils.NL2;
const listToStr = mootils.listToStr;


class Thing {
    constructor(id) {
        this.id = id;
        this.title = 'A Formless Idea';
        this.description = 'A greyish lump of soft, warm matter. It desperately wants to become something.';
        this.holds = [];
    }

    toExtended() {
        return {};
    }
    loadExtended(data) {
    }

    initPostLoad() {
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
    constructor(id) {
        super(id);

        this.exitIds = new Map();  // direction -> thingId
        this.exits = new Map();    // direction -> thing
    }

    toExtended() {
        return {
            exitIds: [...this.exitIds.entries()],
        };
    }
    loadExtended(data) {
        if (data.exitIds) {
            for (const [dir, id] of data.exitIds) {
                this.exitIds.set(dir, id);
            }
        }
    }
    
    initPostLoad() {
        this.exits = new Map();
        for (const [direction, destId] of this.exitIds.entries()) {
            this.exits.set(direction) = moodb.getById(destId);
        }
    }

    addExit(direction, dest) {
        this.exitIds.set(direction, dest.id);
        this.exits.set(direction, dest);
    }

    overview() {
        return `${this.title}. ${listToStr(this.holds, 'is', 'are')} here.`;
    }

    describe() {
        return `${this.title}${NL2}${this.description}${NL2}${listToStr(this.holds, 'is', 'are')} here.`;
    }
}


class Player extends Thing {
    constructor(id, username) {
        super(id);

        this.title = username;
        this.description = 'A mysterious stranger';

        this.locationId = -1;

        this.state = null;
    }

    toExtended() {
        return {
            locationId: this.locationId,
        };
    }
    loadExtended(data) {
        if (data.locationId) {
            this.locationId = data.locationId;
        }
    }

    async travelTo(place) {
        if (this.locationId >= 0) {
            const oldPlace = moodb.getById(this.locationId);
            await oldPlace.thingRemoved(this);
        }

        this.locationId = place.id;
        await place.thingAdded(this);
    }
};


module.exports = {
    Thing,
    Place,
    Player,
};

const moodb = require('./moodb')
