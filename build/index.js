'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Pool = exports.KaplanSniperAgent = exports.UnitAgent = exports.ZIAgent = exports.Trader = exports.Agent = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var async = _interopRequireWildcard(_async);

var _clone = require('clone');

var _clone2 = _interopRequireDefault(_clone);

var _events = require('events');

var _prob = require('prob.js');

var ProbJS = _interopRequireWildcard(_prob);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var privateNextId = 1;
function nextId() {
    return privateNextId++;
}

function sum(a) {
    var i = void 0,
        l = void 0,
        total = 0;
    for (i = 0, l = a.length; i < l; ++i) {
        total += a[i];
    }return total;
}

function dot(a, b) {
    var i = void 0,
        l = void 0,
        total = 0;

    /* istanbul ignore next */

    if (a.length !== b.length) throw new Error("market-agents: vector dimensions do not match in dot(a,b)");
    for (i = 0, l = a.length; i < l; ++i) {
        if (b[i]) total += a[i] * b[i];
    }return total;
}

function poissonWake() {
    var delta = ProbJS.exponential(this.rate)();
    var result = this.wakeTime + delta;
    if (result > 0) return result;
}

/**
 * Agent with Poisson-distributed opportunities to act, with period managment,  optional inventory, unit values and costs, and end-of-period production and consumption to satisfy trades
 *
 */

var Agent = exports.Agent = function (_EventEmitter) {
    _inherits(Agent, _EventEmitter);

    /**
     * creates an Agent with clone of specified options and initializes with .init().
     *   Option properties are stored directly on the created agent's this.  
     *
     * @param {Object} options Agent creation options
     * @param {string} [options.description] text description of agent, optional
     * @param {Object} [options.inventory={}] initial inventory, as object with good names as keys and levels as values
     * @param {string} [options.money='money'] Good used as money by this agent
     * @param {Object} [options.values={}] marginal value table of agent for goods that are redeemed at end-of-period, as object with goods as keys and numeric arrays as values
     * @param {Object} [options.costs={}] marginal cost table of agent for goods that are produced at end-of-period, as object with goods as keys and numeric arrays as values
     * @param {number} [options.wakeTime=0] initial wake-up time for agent, adjusted by this.init() to first poisson-based wake with .nextWake()
     * @param {number} [options.rate=1] Poisson-arrival rate of agent wake events
     * @param {function():number} [options.nextWake=poissonWake] calculates next Agent wake-up time
     * 
     */

    function Agent(options) {
        _classCallCheck(this, Agent);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Agent).call(this));

        var defaults = {
            id: nextId(),
            description: 'blank agent',
            inventory: {},
            money: 'money',
            values: {},
            costs: {},
            wakeTime: 0,
            rate: 1,
            period: {
                number: 0,
                duration: 1000,
                equalDuration: true
            },
            nextWake: poissonWake
        };
        Object.assign(_this, defaults, (0, _clone2.default)(options, false));
        _this.init();
        return _this;
    }

    /**
     * initialize an agent to new settings
     * @param {Object} [newSettings] see constructor
     *
     */

    _createClass(Agent, [{
        key: 'init',
        value: function init(newSettings) {
            if ((typeof newSettings === 'undefined' ? 'undefined' : _typeof(newSettings)) === 'object') {
                // work with a shallow copy of the newSettings so
                // the code can delete the inventory setting without side effects
                var mySettings = Object.assign({}, newSettings);
                // copy new values to inventory.  do not reset other inventory values
                Object.assign(this.inventory, mySettings.inventory);
                // reset non-inventory as specified, completely overwriting previous
                // to execute this reset, first: delete the inventory settings, then apply the remainder
                delete mySettings.inventory;
                Object.assign(this, mySettings);
            }
            // if this.money is defined but is not in inventory, zero the inventory of this.money
            if (this.money && !this.inventory[this.money]) this.inventory[this.money] = 0;
            this.wakeTime = this.nextWake();
        }

        /** 
         * re-initialize agent to the beginning of a new simulation period
         * 
         * @param {number|Object} period A period initialization object, or a number indicating a new period using the previous period's initialization object
         * @param {number} period.number A number, usually sequential, identifying the next period, e.g. 1,2,3,4,5,...
         * @param {boolean} [period.equalDuration=false] with positive period.duration, autogenerates startTime and endTime as n or n+1 times period.duration
         * @param {number} [period.duration] the length of the period, used with period.equalDuration
         * @param {number} [period.startTime] period begins, manual setting for initial time value for agent wakeTime
         * @param {number} [period.endTime] period ends, no agent wake events will be emitted for this period after this time
         * @param {Object} [period.init] initializer for other agent properties, passed to .init()
         * @emits {pre-period} when initialization to new period is complete
         * @example
         * myAgent.initPeriod({number:1, duration:1000, equalDuration: true});
         * myAgent.initPeriod(2);
         */

    }, {
        key: 'initPeriod',
        value: function initPeriod(period) {
            // period might look like this
            // period = {number:5, startTime:50000, init: {inventory:{X:0, Y:0}, values:{X:[300,200,100,0,0,0,0]}}}
            // or period could be simply a number
            if ((typeof period === 'undefined' ? 'undefined' : _typeof(period)) === 'object') this.period = (0, _clone2.default)(period, false);else if (typeof period === 'number') this.period.number = period;
            if (this.period.equalDuration && this.period.duration) {
                this.period.startTime = this.period.number * this.period.duration;
                this.period.endTime = (1 + this.period.number) * this.period.duration;
            }
            if (typeof this.period.startTime === 'number') this.wakeTime = this.period.startTime;
            this.init(this.period.init);
            this.emit('pre-period');
        }

        /**
         * ends current period, causing agent to undertake end-of-period tasks such as production and redemption of units
         *
         * @emits {post-period} when period ends, always, but after first completing any production/redemption
         */

    }, {
        key: 'endPeriod',
        value: function endPeriod() {
            if (typeof this.produce === 'function') this.produce();
            if (typeof this.redeem === 'function') this.redeem();
            this.emit('post-period');
        }

        /** 
         * percent of period used 
         *
         * @return {number} proportion of period time used as a number from 0.0, at beginning of period, to 1.0 at end of period.
         *
         */

    }, {
        key: 'pctPeriod',
        value: function pctPeriod() {
            if (this.period.startTime !== undefined && this.period.endTime > 0 && this.wakeTime !== undefined) {
                return (this.wakeTime - this.period.startTime) / (this.period.endTime - this.period.startTime);
            }
        }

        /**
         * guess at number of random Poisson wakes remaining in period
         * 
         * @return {number} "expected" number of remaining random Poisson wakes, calculated as (this.period.endTime-this.wakeTime)*rate
         * 
         */

    }, {
        key: 'poissonWakesRemainingInPeriod',
        value: function poissonWakesRemainingInPeriod() {
            if (this.rate > 0 && this.wakeTime !== undefined && this.period.endTime > 0) {
                return (this.period.endTime - this.wakeTime) * this.rate;
            }
        }

        /**
         * wakes agent so it can act, emitting wake, and sets next wakeTime from this.nextWake() unless period.endTime exceeded 
         *
         * @param {Object} [info] optional info passed to this.emit('wake', info)
         * @emits {wake(info)} immediately
         */

    }, {
        key: 'wake',
        value: function wake(info) {
            this.emit('wake', info);
            var nextTime = this.nextWake();
            if (this.period.endTime) {
                if (nextTime < this.period.endTime) this.wakeTime = nextTime;else this.wakeTime = undefined;
            } else {
                this.wakeTime = nextTime;
            }
        }

        /** 
         * increases or decreases agent's inventories of one or more goods and/or money
         * 
         * @param {Object} myTransfers object with goods as keys and changes in inventory as number values
         * @param {Object} [memo] optional memo passed to event listeners
         * @emits {pre-transfer(myTransfers, memo)} before transfer takes place, modifications to myTransfers will change transfer
         * @emits {post-transfer(myTransfers, memo)} after transfer takes place
         */

    }, {
        key: 'transfer',
        value: function transfer(myTransfers, memo) {
            if (myTransfers) {
                this.emit('pre-transfer', myTransfers, memo);
                var goods = Object.keys(myTransfers);
                for (var i = 0, l = goods.length; i < l; ++i) {
                    if (this.inventory[goods[i]]) this.inventory[goods[i]] += myTransfers[goods[i]];else this.inventory[goods[i]] = myTransfers[goods[i]];
                }
                this.emit('post-transfer', myTransfers, memo);
            }
        }

        /** 
         * agent's marginal cost of producing next unit
         *
         * @param {String} good (e.g. "X", "Y")
         * @param {Object} hypotheticalInventory object with goods as keys and values as numeric levels of inventory 
         * @return {number} marginal unit cost of next unit, at given (negative) hyptothetical inventory, using agent's configured costs
         */

    }, {
        key: 'unitCostFunction',
        value: function unitCostFunction(good, hypotheticalInventory) {
            var costs = this.costs[good];
            if (Array.isArray(costs) && hypotheticalInventory[good] <= 0) {
                return costs[-hypotheticalInventory[good]];
            }
        }

        /**
         * agent's marginal value for redeeming next unit
         *
         * @param {String} good (e.g. "X", "Y")
         * @param {Object} hypotheticalInventory object with goods as keys and values as numeric levels of inventory 
         * @return {number} marginal unit value of next unit, at given (positive) hyptothetical inventory, using agent's configured values
         */

    }, {
        key: 'unitValueFunction',
        value: function unitValueFunction(good, hypotheticalInventory) {
            var vals = this.values[good];
            if (Array.isArray(vals) && hypotheticalInventory[good] >= 0) {
                return vals[hypotheticalInventory[good]];
            }
        }

        /** 
         * redeems units in positive inventory with configured values, usually called automatically at end-of-period.
         * transfer uses memo object {isRedeem:1} 
         * 
         * @emits {pre-redeem(transferAmounts)} before calling .transfer, can modify transferAmounts
         * @emits {post-redeem(transferAmounts)} after calling .transfer
         */

    }, {
        key: 'redeem',
        value: function redeem() {
            if (this.values) {
                var trans = {};
                var goods = Object.keys(this.values);
                trans[this.money] = 0;
                for (var i = 0, l = goods.length; i < l; ++i) {
                    var g = goods[i];
                    if (this.inventory[g] > 0) {
                        trans[g] = -this.inventory[g];
                        trans[this.money] += sum(this.values[g].slice(0, this.inventory[g]));
                    }
                }
                this.emit('pre-redeem', trans);
                this.transfer(trans, { isRedeem: 1 });
                this.emit('post-redeem', trans);
            }
        }

        /** 
         * produces units in negative inventory with configured costs, usually called automatically at end-of-period.
         * transfer uses memo object {isProduce:1}
         * 
         * @emits {pre-redeem(transferAmounts)} before calling .transfer, can modify transferAmounts
         * @emits {post-redeem(transferAmounts)} after calling .transfer
         */

    }, {
        key: 'produce',
        value: function produce() {
            if (this.costs) {
                var trans = {};
                var goods = Object.keys(this.costs);
                trans[this.money] = 0;
                for (var i = 0, l = goods.length; i < l; ++i) {
                    var g = goods[i];
                    if (this.inventory[g] < 0) {
                        trans[this.money] -= sum(this.costs[g].slice(0, -this.inventory[g]));
                        trans[g] = -this.inventory[g];
                    }
                }
                this.emit('pre-produce', trans);
                this.transfer(trans, { isProduce: 1 });
                this.emit('post-produce', trans);
            }
        }
    }]);

    return Agent;
}(_events.EventEmitter);

/**
 * agent that places trades in one or more markets based on marginal costs or values
 *
 * This is an abstract class, meant to be subclassed for particular strategies.
 *
 */

var Trader = exports.Trader = function (_Agent) {
    _inherits(Trader, _Agent);

    /**
     * @param {Object} [options] passed to Agent constructor(); Trader specific properties detailed below
     * @param {Array<Object>} [options.markets=[]] list of market objects where this agent acts on wake 
     * @param {number} [options.minPrice=0] minimum price when submitting limit orders to buy 
     * @param {number} [options.maxPrice=1000] maximum price when submitting sell limit orders to sell
     * @param {boolean} [options.ignoreBudgetConstraint=false] ignore budget constraint, substituting maxPrice for unit value when bidding, and minPrice for unit cost when selling
     * @listens {wake} to trigger sendBidsAndAsks()  
     *
     */

    function Trader(options) {
        _classCallCheck(this, Trader);

        var defaults = {
            description: 'Trader',
            markets: [],
            minPrice: 0,
            maxPrice: 1000
        };

        var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(Trader).call(this, Object.assign({}, defaults, options)));

        _this2.on('wake', _this2.sendBidsAndAsks);
        return _this2;
    }

    /** send a limit order to buy one unit to the indicated market at myPrice. Placeholder throws error. Must be overridden and implemented in other code.
     * @abstract
     * @param {Object} market 
     * @param {number} myPrice
     * @throws {Error} when calling placeholder
     */

    // eslint-disable-next-line no-unused-vars


    _createClass(Trader, [{
        key: 'bid',
        value: function bid(market, myPrice) {
            throw new Error("called placeholder for abstract method .bid(market,myPrice) -- you must implement this method");
        }

        /** 
         * send a limit order to sell one unit to the indicated market at myPrice. Placeholder throws error. Must be overridden and implemented in other code. 
         * @abstract 
         * @param {Object} market 
         * @param {number} myPrice
         * @throws {Error} when calling placeholder 
         */

        // eslint-disable-next-line no-unused-vars

    }, {
        key: 'ask',
        value: function ask(market, myPrice) {
            throw new Error("called placeholder for abstract method .ask(market,myPrice) -- you must implement this method");
        }

        /**
         * calculate price this agent is willing to pay.  Placeholder throws error.  Must be overridden and implemented in other code.
         * 
         * @abstract
         * @param {number} marginalValue The marginal value of redeeming the next unit. sets the maximum price for random price generation
         * @param {Object} market For requesting current market conditions, previous trade price, etc.
         * @return {number|undefined} agent's buy price or undefined if not willing to buy
         * @throws {Error} when calling placeholder
         */

        // eslint-disable-next-line no-unused-vars

    }, {
        key: 'bidPrice',
        value: function bidPrice(marginalValue, market) {
            throw new Error("called placeholder for abstract method .bidPrice(marginalValue, market) -- you must implement this method");
        }

        /**
         * calculate price this agent is willing to accept. Placeholder throws error. Must be overridden and implemented in other code. 
         * 
         * 
         * @abstract
         * @param {number} marginalCost the marginal coat of producing the next unit. sets the minimum price for random price generation
         * @param {Object} market For requesting current market conditions, previous trade price, etc.
         * @return {number|undefined} agent's sell price or undefined if not willing to sell
         */

        // eslint-disable-next-line no-unused-vars

    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost, market) {
            throw new Error("called placeholder for abstract method .bidPrice(marginalValue, market) -- you must implement this method");
        }

        /**
         * for each market in markets, calculates agent's strategy for buy or sell prices  and then sends limit orders for 1 unit at those prices
         *
         * 
         * 
         */

    }, {
        key: 'sendBidsAndAsks',
        value: function sendBidsAndAsks() {
            for (var i = 0, l = this.markets.length; i < l; ++i) {
                var market = this.markets[i];
                var unitValue = this.unitValueFunction(market.goods, this.inventory);
                if (unitValue > 0) {
                    if (this.ignoreBudgetConstraint) unitValue = this.maxPrice;
                    var myPrice = this.bidPrice(unitValue, market); // calculate my buy price proposal
                    if (myPrice) this.bid(market, myPrice); // send my price proposal
                }
                var unitCost = this.unitCostFunction(market.goods, this.inventory);
                if (unitCost > 0) {
                    if (this.ignoreBudgetConstraint) unitCost = this.minPrice;
                    var _myPrice = this.askPrice(unitCost, market); // calculate my sell price proposal
                    if (_myPrice) this.ask(market, _myPrice); // send my price proposal
                }
            }
        }
    }]);

    return Trader;
}(Agent);

/**
 * robot agent based on my implementation of Gode and Sunder's "Zero Intelligence" robots, as described in the economics research literature.
 * 
 * see 
 *    Gode,  Dhananjay  K.,  and  S.  Sunder.  [1993].  ‘Allocative  efficiency  of  markets  with  zero-intelligence  traders:  Market  as  a  partial  substitute  for  individual  rationality.’    Journal  of  Political  Economy, vol. 101, pp.119-137. 
 *    Gode, Dhananjay K., and S. Sunder. [1993b]. ‘Lower bounds for efficiency of surplus extraction in double auctions.’  In  Friedman,  D.  and  J.  Rust  (eds).  The  Double  Auction  Market:  Institutions,  Theories,  and Evidence,  pp. 199-219. 
 *    Gode,  Dhananjay  K.,  and  S.  Sunder.  [1997].  ‘Double  auction  dynamics:  structural  consequences  of  non-binding price controls.’  Mimeo. Gode,  Dhananjay  K.,  and  S.  Sunder.  [1997a].  ‘What  makes  markets  allocationally  efficient?’  Quarterly Journal of Economics, vol. 112 (May), pp.603-630. 
 * 
 */

var ZIAgent = exports.ZIAgent = function (_Trader) {
    _inherits(ZIAgent, _Trader);

    /*
     * creates "Zero Intelligence" robot agent similar to those described in Gode and Sunder (1993)
     * 
     * @param {Object} [options] passed to Trader and Agent constructors()
     * @param {boolean} [options.integer] true instructs pricing routines to use positive integer prices, false allows positive real number prices
     */

    function ZIAgent(options) {
        _classCallCheck(this, ZIAgent);

        return _possibleConstructorReturn(this, Object.getPrototypeOf(ZIAgent).call(this, Object.assign({}, { description: 'Gode and Sunder Style ZI Agent' }, options)));
    }

    /**
     * calculate price this agent is willing to pay as a uniform random number ~ U[minPrice, marginalValue] inclusive.
     * If this.integer is true, the returned price will be an integer.
     * 
     * 
     * @param {number} marginalValue the marginal value of redeeming the next unit. sets the maximum price for random price generation 
     * @return {number|undefined} randomized buy price or undefined if marginalValue non-numeric or less than this.minPrice
     */

    _createClass(ZIAgent, [{
        key: 'bidPrice',
        value: function bidPrice(marginalValue) {
            if (typeof marginalValue !== 'number') return undefined;
            var p = void 0;
            if (marginalValue === this.minPrice) return marginalValue;
            if (marginalValue < this.minPrice) return undefined;
            if (this.integer) {

                /* because Floor rounds down, add 1 to value to be in the range of possible prices */
                /* guard against rare edge case with do/while */

                do {
                    p = Math.floor(ProbJS.uniform(this.minPrice, marginalValue + 1)());
                } while (p > marginalValue);
            } else {
                p = ProbJS.uniform(this.minPrice, marginalValue)();
            }
            return p;
        }

        /**
         * calculate price this agent is willing to accept as a uniform random number ~ U[marginalCost, maxPrice] inclusive.
         * If this.integer is true, the returned price will be an integer.
         * 
         *
         * @param {number} marginalCost the marginal coat of producing the next unit. sets the minimum price for random price generation
         * @return {number|undefined} randomized sell price or undefined if marginalCost non-numeric or greater than this.maxPrice
         */

    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost) {
            if (typeof marginalCost !== 'number') return undefined;
            var p = void 0;
            if (marginalCost === this.maxPrice) return marginalCost;
            if (marginalCost > this.maxPrice) return undefined;
            if (this.integer) {

                /* because Floor rounds down, add 1 to value to be in the range of possible prices */
                /* guard against rare edge case with do/while */

                do {
                    p = Math.floor(ProbJS.uniform(marginalCost, this.maxPrice + 1)());
                } while (p > this.maxPrice);
            } else {
                p = ProbJS.uniform(marginalCost, this.maxPrice)();
            }
            return p;
        }
    }]);

    return ZIAgent;
}(Trader);

var um1p2 = ProbJS.uniform(-1, 2);
var um1p1 = ProbJS.uniform(-1, 1);

var UnitAgent = exports.UnitAgent = function (_Trader2) {
    _inherits(UnitAgent, _Trader2);

    function UnitAgent(options) {
        _classCallCheck(this, UnitAgent);

        var defaults = {
            description: "Paul Brewer's HBEER UNIT agent that bids/asks within 1 price unit of previous price"
        };
        return _possibleConstructorReturn(this, Object.getPrototypeOf(UnitAgent).call(this, Object.assign({}, defaults, options)));
    }

    _createClass(UnitAgent, [{
        key: 'randomDelta',
        value: function randomDelta() {
            var delta = void 0;
            if (this.integer) {
                do {
                    delta = Math.floor(um1p2());
                } while (delta <= -2 || delta >= 2.0);
            } else {
                do {
                    delta = um1p1();
                } while (delta < -1 || delta > 1);
            }
            return delta;
        }
    }, {
        key: 'bidPrice',
        value: function bidPrice(marginalValue, market) {
            var p = void 0;
            if (typeof marginalValue !== 'number') return undefined;
            var previous = market.lastTradePrice();
            if (previous) p = previous + this.randomDelta();else p = _get(Object.getPrototypeOf(UnitAgent.prototype), 'bidPrice', this).call(this, marginalValue);
            if (p > marginalValue || p > this.maxPrice || p < this.minPrice) return undefined;
            return p && this.integer ? Math.floor(p) : p;
        }
    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost, market) {
            if (typeof marginalCost !== 'number') return undefined;
            var p = void 0;
            var previous = market.lastTradePrice();
            if (previous) p = previous + this.randomDelta();else p = _get(Object.getPrototypeOf(UnitAgent.prototype), 'askPrice', this).call(this, marginalCost);
            if (p < marginalCost || p > this.maxPrice || p < this.minPrice) return undefined;
            return p && this.integer ? Math.floor(p) : p;
        }
    }]);

    return UnitAgent;
}(Trader);

/* see e.g. "High Performance Bidding Agents for the Continuous Double Auction" 
 *                Gerald Tesauro and Rajarshi Das, Institute for Advanced Commerce, IBM 
 *
 *  http://researcher.watson.ibm.com/researcher/files/us-kephart/dblauc.pdf
 *
 *      for discussion of Kaplan's Sniper traders on pp. 4-5
*/

var KaplanSniperAgent = exports.KaplanSniperAgent = function (_Trader3) {
    _inherits(KaplanSniperAgent, _Trader3);

    function KaplanSniperAgent(options) {
        _classCallCheck(this, KaplanSniperAgent);

        var defaults = {
            description: "Kaplan's snipers, trade on 'juicy' price, or low spread, or end of period",
            desiredSpread: 10
        };
        return _possibleConstructorReturn(this, Object.getPrototypeOf(KaplanSniperAgent).call(this, Object.assign({}, defaults, options)));
    }

    _createClass(KaplanSniperAgent, [{
        key: 'bidPrice',
        value: function bidPrice(marginalValue, market) {
            if (typeof marginalValue !== 'number') return undefined;
            var currentBid = market.currentBidPrice();
            var currentAsk = market.currentAskPrice();

            // a trade can only occur if currentAsk <= marginalValue
            if (currentAsk <= marginalValue) {

                // snipe if ask price is less than or equal to juicy ask price
                var juicyPrice = this.getJuicyAskPrice();
                if (juicyPrice > 0 && currentAsk <= juicyPrice) return currentAsk;

                // snipe if low bid ask spread
                if (currentAsk > 0 && currentBid > 0 && currentAsk - currentBid <= this.desiredSpread) return currentAsk;

                // snipe if period end is three wakes away or less
                if (this.poissonWakesRemainingInPeriod() <= 3) return currentAsk;
            }
            // otherwise return undefined
        }
    }, {
        key: 'askPrice',
        value: function askPrice(marginalCost, market) {
            if (typeof marginalCost !== 'number') return undefined;
            var currentBid = market.currentBidPrice();
            var currentAsk = market.currentAskPrice();
            // only trade if currentBid >= marginalCost
            if (currentBid >= marginalCost) {

                // snipe if bid price is greater than or equal to juicy bid price
                var juicyPrice = this.getJuicyBidPrice();
                if (juicyPrice > 0 && currentBid >= juicyPrice) return currentBid;

                // snipe if low bid ask spread
                if (currentAsk > 0 && currentBid > 0 && currentAsk - currentBid <= this.desiredSpread) return currentBid;

                // snipe if period end is three wakes away or less
                if (this.poissonWakesRemainingInPeriod() <= 3) return currentBid;
            }
            // otherwise return undefined
        }
    }]);

    return KaplanSniperAgent;
}(Trader);

var Pool = exports.Pool = function () {
    function Pool() {
        _classCallCheck(this, Pool);

        this.agents = [];
        this.agentsById = {};
    }

    _createClass(Pool, [{
        key: 'push',
        value: function push(agent) {
            if (!(agent instanceof Agent)) throw new Error("Pool.push(agent), agent is not an instance of Agent or descendents");
            if (!this.agentsById[agent.id]) {
                this.agents.push(agent);
                this.agentsById[agent.id] = agent;
            }
        }
    }, {
        key: 'next',
        value: function next() {
            if (this.nextCache) return this.nextCache;
            var tMin = 1e20,
                i = 0,
                l = this.agents.length,
                A = this.agents,
                t = 0,
                result = 0;
            for (; i < l; i++) {
                t = A[i].wakeTime;
                if (t > 0 && t < tMin) {
                    result = A[i];
                    tMin = t;
                }
            }
            this.nextCache = result;
            return result;
        }
    }, {
        key: 'wake',
        value: function wake() {
            var A = this.next();
            if (A) {
                A.wake();
                // wipe nextCache
                delete this.nextCache;
            }
        }
    }, {
        key: 'endTime',
        value: function endTime() {
            var endTime = 0;
            for (var i = 0, l = this.agents.length; i < l; ++i) {
                var a = this.agents[i];
                if (a.period.endTime > endTime) endTime = a.period.endTime;
            }
            if (endTime > 0) return endTime;
        }
    }, {
        key: 'run',
        value: function run(untilTime, done, batch) {
            // note: setTimeout slows this down significnatly if setImmediate is not available
            var that = this;
            if (typeof done !== 'function') throw new Error("Pool.run: done callback function undefined");
            async.whilst(function () {
                var nextAgent = that.next();
                return nextAgent && nextAgent.wakeTime < untilTime;
            }, function (cb) {
                async.setImmediate(function () {
                    that.syncRun(untilTime, batch || 1);
                    cb();
                });
            }, function (e) {
                done.call(that, e);
            });
        }
    }, {
        key: 'syncRun',
        value: function syncRun(untilTime, limitCalls) {
            var nextAgent = this.next();
            var calls = 0;
            while (nextAgent && nextAgent.wakeTime < untilTime && !(calls >= limitCalls)) {
                this.wake();
                nextAgent = this.next();
                calls++;
            }
        }
    }, {
        key: 'initPeriod',
        value: function initPeriod(param) {
            // passing param to all the agents is safe because Agent.initPeriod does a deep clone
            if (Array.isArray(param) && param.length > 0) {
                for (var i = 0, l = this.agents.length; i < l; i++) {
                    this.agents[i].initPeriod(param[i % param.length]);
                }
            } else {
                for (var _i = 0, _l = this.agents.length; _i < _l; _i++) {
                    this.agents[_i].initPeriod(param);
                }
            }
        }
    }, {
        key: 'endPeriod',
        value: function endPeriod() {
            for (var i = 0, l = this.agents.length; i < l; i++) {
                this.agents[i].endPeriod();
            }
        }
    }, {
        key: 'trade',
        value: function trade(tradeSpec) {
            var i = void 0,
                l = void 0,
                buyerTransfer = void 0,
                sellerTransfer = void 0;
            if ((typeof tradeSpec === 'undefined' ? 'undefined' : _typeof(tradeSpec)) !== 'object') return;
            if (tradeSpec.bs && tradeSpec.goods && tradeSpec.money && Array.isArray(tradeSpec.prices) && Array.isArray(tradeSpec.buyQ) && Array.isArray(tradeSpec.sellQ) && Array.isArray(tradeSpec.buyId) && Array.isArray(tradeSpec.sellId)) {
                if (tradeSpec.bs === 'b') {
                    if (tradeSpec.buyId.length !== 1) throw new Error("Pool.trade expected tradeSpec.buyId.length===1, got:" + tradeSpec.buyId.length);
                    if (tradeSpec.buyQ[0] !== sum(tradeSpec.sellQ)) throw new Error("Pool.trade invalid buy -- tradeSpec buyQ[0] != sum(sellQ)");
                    buyerTransfer = {};
                    buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[0];
                    buyerTransfer[tradeSpec.money] = -dot(tradeSpec.sellQ, tradeSpec.prices);
                    this.agentsById[tradeSpec.buyId[0]].transfer(buyerTransfer, { isTrade: 1, isBuy: 1 });
                    for (i = 0, l = tradeSpec.prices.length; i < l; ++i) {
                        sellerTransfer = {};
                        sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[i];
                        sellerTransfer[tradeSpec.money] = tradeSpec.prices[i] * tradeSpec.sellQ[i];
                        this.agentsById[tradeSpec.sellId[i]].transfer(sellerTransfer, { isTrade: 1, isSellAccepted: 1 });
                    }
                } else if (tradeSpec.bs === 's') {
                    if (tradeSpec.sellId.length !== 1) throw new Error("Pool.trade expected tradeSpec.sellId.length===1. got:" + tradeSpec.sellId.length);
                    if (tradeSpec.sellQ[0] !== sum(tradeSpec.buyQ)) throw new Error("Pool.trade invalid sell -- tradeSpec sellQ[0] != sum(buyQ)");
                    sellerTransfer = {};
                    sellerTransfer[tradeSpec.goods] = -tradeSpec.sellQ[0];
                    sellerTransfer[tradeSpec.money] = dot(tradeSpec.buyQ, tradeSpec.prices);
                    this.agentsById[tradeSpec.sellId[0]].transfer(sellerTransfer, { isTrade: 1, isSell: 1 });
                    for (i = 0, l = tradeSpec.prices.length; i < l; ++i) {
                        buyerTransfer = {};
                        buyerTransfer[tradeSpec.goods] = tradeSpec.buyQ[i];
                        buyerTransfer[tradeSpec.money] = -tradeSpec.prices[i] * tradeSpec.buyQ[i];
                        this.agentsById[tradeSpec.buyId[i]].transfer(buyerTransfer, { isTrade: 1, isBuyAccepted: 1 });
                    }
                }
            }
        }
    }, {
        key: 'distribute',
        value: function distribute(field, good, aggregateArray) {
            var i = void 0,
                l = void 0;
            var myCopy = void 0;
            if (Array.isArray(aggregateArray)) {
                myCopy = aggregateArray.slice();
            } else if (typeof aggregateArray === 'string') {
                myCopy = aggregateArray.replace(/,/g, " ").split(/\s+/).map(function (s) {
                    return +s;
                }).filter(function (v) {
                    return v > 0;
                });
            } else {

                /* istanbul ignore next */

                throw new Error("Error: Pool.prototype.distribute: expected aggregate to be Array or String, got: " + (typeof aggregateArray === 'undefined' ? 'undefined' : _typeof(aggregateArray)));
            }
            if (field !== 'values' && field !== 'costs') throw new Error("Pool.distribute(field,good,aggArray) field should be 'values' or 'costs', got:" + field);
            for (i = 0, l = this.agents.length; i < l; ++i) {
                if (typeof this.agents[i][field] === 'undefined') this.agents[i][field] = {};
                this.agents[i][field][good] = [];
            }
            i = 0;
            l = this.agents.length;
            while (myCopy.length > 0) {
                this.agents[i][field][good].push(myCopy.shift());
                i = (i + 1) % l;
            }
        }
    }]);

    return Pool;
}();