/**
 * Represents Sublists and their field access. Sublists use a different api than body fields in NS.
 * Note that in NFT-SS1.0 we collapsed the sublist and body descriptors into a common codebase. Decided not to do
 * that here (yet) in interest of code clarity. Also the fact that it's only two copies (usually use the rule of
 * three's for DRY).
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "N/format", "../EC_Logger"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format = require("N/format");
    var LogManager = require("../EC_Logger");
    var log = LogManager.getLogger('nsdal');
    /*
     note that numeric sublist fields seem to do ok with the defaultdescriptor with the exception of percent fields.
     this differs from body fields behavior - it seems body fields required the numericDescriptor (see numericDescriptor
     in Record.ts
     */
    /**
     * decorators for sublist fields. Adorn your class properties with these to bind your class property name with
     * the specific behavior for the type of field it represents in NetSuite.
     */
    var SublistFieldType;
    (function (SublistFieldType) {
        SublistFieldType.checkbox = defaultSublistDescriptor;
        SublistFieldType.currency = defaultSublistDescriptor;
        SublistFieldType.date = defaultSublistDescriptor;
        SublistFieldType.datetime = defaultSublistDescriptor;
        SublistFieldType.email = defaultSublistDescriptor;
        SublistFieldType.freeformtext = defaultSublistDescriptor;
        SublistFieldType.decimalnumber = defaultSublistDescriptor;
        SublistFieldType.float = defaultSublistDescriptor;
        SublistFieldType.hyperlink = defaultSublistDescriptor;
        SublistFieldType.image = defaultSublistDescriptor;
        SublistFieldType.inlinehtml = defaultSublistDescriptor;
        SublistFieldType.integernumber = defaultSublistDescriptor;
        SublistFieldType.longtext = defaultSublistDescriptor;
        SublistFieldType.multiselect = defaultSublistDescriptor;
        SublistFieldType.percent = function (target, propertyKey) { return formattedSublistDescriptor(format.Type.PERCENT, target, propertyKey); };
        SublistFieldType.select = defaultSublistDescriptor;
        SublistFieldType.textarea = defaultSublistDescriptor;
        SublistFieldType.subrecord = subrecordDescriptor;
    })(SublistFieldType = exports.SublistFieldType || (exports.SublistFieldType = {}));
    /**
     * Generic property descriptor with basic default algorithm that exposes the field value directly with no
     * other processing. If the target field name ends with 'Text' it uses NetSuite `getText()/setText()` otherwise (default)
     * uses `getValue()/setValue()`
     * @returns an object property descriptor to be used
     * with Object.defineProperty
     */
    function defaultSublistDescriptor(target, propertyKey) {
        log.debug('creating default descriptor', "field: " + propertyKey);
        var _a = parseProp(propertyKey), isTextField = _a[0], nsfield = _a[1];
        return {
            get: function () {
                var options = {
                    sublistId: this.sublistId,
                    line: this._line,
                    fieldId: nsfield,
                };
                log.debug("getting sublist " + (isTextField ? 'text' : 'value'), options);
                return isTextField ? this.nsrecord.getSublistText(options) : this.nsrecord.getSublistValue(options);
            },
            set: function (value) {
                // ignore undefined's
                if (value !== undefined) {
                    var options = {
                        sublistId: this.sublistId,
                        line: this._line,
                        fieldId: nsfield
                    };
                    isTextField ? this.nsrecord.setSublistText(__assign({}, options, { text: value }))
                        : this.nsrecord.setSublistValue(__assign({}, options, { value: value }));
                }
                else
                    log.debug("ignoring field [" + nsfield + "]", 'field value is undefined');
            },
            enumerable: true //default is false
        };
    }
    /**
     * Generic property descriptor with algorithm for values that need to go through the NS format module
     * note: does not take into account timezone
     * @param {string} formatType the NS field type (e.g. 'date')
     * @param target
     * @param propertyKey
     * @returns  an object property descriptor to be used
     * with decorators
     */
    function formattedSublistDescriptor(formatType, target, propertyKey) {
        return {
            get: function () {
                log.debug("getting formatted field [" + propertyKey + "]");
                var value = this.nsrecord.getSublistValue({
                    sublistId: this.sublistId,
                    line: this._line,
                    fieldId: propertyKey,
                }); // to satisfy typing for format.parse(value) below.
                log.debug("transforming field [" + propertyKey + "] of type [" + formatType + "]", "with value " + value);
                // ensure we don't return moments for null, undefined, etc.
                // returns the 'raw' type which is a string or number for our purposes
                return value ? format.parse({ type: formatType, value: value }) : value;
            },
            set: function (value) {
                var formattedValue;
                // allow null to flow through, but ignore undefined's
                if (value !== undefined) {
                    switch (formatType) {
                        // ensure numeric typed fields get formatted to what netsuite needs
                        // in testing with 2016.1 fields like currency had to be a number formatted specifically (e.g. 1.00
                        // rather than 1 or 1.0 for them to be accepted without error
                        case format.Type.CURRENCY:
                        case format.Type.CURRENCY2:
                        case format.Type.FLOAT:
                        case format.Type.INTEGER:
                        case format.Type.NONNEGCURRENCY:
                        case format.Type.NONNEGFLOAT:
                        case format.Type.POSCURRENCY:
                        case format.Type.POSFLOAT:
                        case format.Type.POSINTEGER:
                        case format.Type.RATE:
                        case format.Type.RATEHIGHPRECISION:
                            formattedValue = Number(format.format({ type: formatType, value: value }));
                            break;
                        default:
                            formattedValue = format.format({ type: formatType, value: value });
                    }
                    log.debug("setting sublist field [" + propertyKey + ":" + formatType + "]", "to formatted value [" + formattedValue + "] (unformatted vale: " + value + ")");
                    if (value === null)
                        this.nsrecord.setSublistValue({
                            sublistId: this.sublistId,
                            line: this._line,
                            fieldId: propertyKey,
                            value: null
                        });
                    else
                        this.nsrecord.setSublistValue({
                            sublistId: this.sublistId,
                            line: this._line,
                            fieldId: propertyKey,
                            value: formattedValue
                        });
                }
                else
                    log.info("not setting sublist " + propertyKey + " field", 'value was undefined');
            },
            enumerable: true //default is false
        };
    }
    exports.formattedSublistDescriptor = formattedSublistDescriptor;
    /**
     * Decorator for *subrecord* fields with the subrecord shape represented by T (which
     * defines the properties you want on the subrecord)
     * @param ctor Constructor for the subrecord class you want (e.g. `AddressBase`, `InventoryDetail`).
     */
    function subrecordDescriptor(ctor) {
        return function (target, propertyKey) {
            return {
                enumerable: true,
                // sublist is read only for now - if we have a use case where this should be assigned then tackle it
                get: function () {
                    return new ctor(this.nsrecord.getSublistSubrecord({
                        fieldId: propertyKey,
                        line: this._line,
                        sublistId: this.sublistId
                    }));
                },
            };
        };
    }
    exports.subrecordDescriptor = subrecordDescriptor;
    /**
     * parses a property name from a declaration (supporting 'Text' suffix per our convention)
     * @param propertyKey original property name as declared on class
     * @returns pair consisting of a flag indicating this field wants 'text' behavior and the actual ns field name (with
     * Text suffix removed)
     */
    function parseProp(propertyKey) {
        var endsWithText = propertyKey.slice(-4) === 'Text';
        return [endsWithText, endsWithText ? propertyKey.replace('Text', '') : propertyKey];
    }
    /**
     * creates a sublist whose lines are of type T
     */
    var Sublist = /** @class */ (function () {
        function Sublist(sublistLineType, rec, sublistId) {
            this.sublistLineType = sublistLineType;
            this.sublistId = sublistId;
            this.sublistLineType = sublistLineType;
            this.makeRecordProp(rec);
            log.debug('creating sublist', "type:" + sublistId + ", linecount:" + this.length);
            // create a sublist line indexed property of type T for each member of the underlying sublist
            for (var i = 0; i < this.length; i++) {
                this[i] = new sublistLineType(this.sublistId, this.nsrecord, i);
            }
        }
        Object.defineProperty(Sublist.prototype, "length", {
            /**
             * array-like length property (linecount)
             * @returns {number} number of lines in this list
             */
            get: function () {
                return this.nsrecord.getLineCount({ sublistId: this.sublistId });
            },
            enumerable: true,
            configurable: true
        });
        /**
         * adds a new line to this sublist
         * @param ignoreRecalc
         */
        Sublist.prototype.addLine = function (ignoreRecalc) {
            if (ignoreRecalc === void 0) { ignoreRecalc = true; }
            log.debug('inserting line', "sublist: " + this.sublistId + " insert at line:" + this.length);
            var insertAt = this.length;
            this[insertAt] = new this.sublistLineType(this.sublistId, this.nsrecord, insertAt);
            this.nsrecord.insertLine({
                sublistId: this.sublistId,
                line: insertAt,
                ignoreRecalc: ignoreRecalc
            });
            log.debug('line count after adding', this.length);
            return this[insertAt];
        };
        /**
         * Removes all existing lines of this sublist, leaving effectively an empty array
         * @param ignoreRecalc passed through to nsrecord.removeLine (ignores firing recalc event as each line is removed )
         */
        Sublist.prototype.removeAllLines = function (ignoreRecalc) {
            if (ignoreRecalc === void 0) { ignoreRecalc = true; }
            while (this.length > 0) {
                var line = {
                    sublistId: this.sublistId,
                    ignoreRecalc: ignoreRecalc,
                    line: this.length - 1
                };
                this.nsrecord.removeLine(line);
                log.debug('removed line', line);
            }
            return this;
        };
        /**
         * commits the currently selected line on this sublist. When adding new lines you don't need to call this method
         */
        Sublist.prototype.commitLine = function () {
            log.debug('committing line', "sublist: " + this.sublistId);
            this.nsrecord.commitLine({ sublistId: this.sublistId });
        };
        Sublist.prototype.selectLine = function (line) {
            log.debug('selecting line', line);
            this.nsrecord.selectLine({ sublistId: this.sublistId, line: line });
        };
        /**
         * Defines a descriptor for nsrecord so as to prevent it from being enumerable. Conceptually only the
         * field properties defined on derived classes should be seen when enumerating
         * @param value
         */
        Sublist.prototype.makeRecordProp = function (value) {
            Object.defineProperty(this, 'nsrecord', {
                value: value,
                enumerable: false
            });
        };
        return Sublist;
    }());
    exports.Sublist = Sublist;
    /**
     * contains minimum requirements for a sublist line - 1. which sublist are we working with, 2. on which record
     * 3. which line on the sublist does this instance represent
     *
     * You extend from this class (or a pre-existing subclass) to define the fields to surface on the NetSuite sublist.
     * Class property names should be the netsuite field internal id. By default these fields surface the `value` of the field
     * To `get/setText()` instead, append the field name with `Text`.
     *
     * @example Surfaces the `price` field both as _value_ (numeric internal id) and _text_
     *       class SalesOrderItemSublist extends SublistLine {
     *         @SublistFieldType.select
     *         price:number
     *
     *         @SublistFieldType.freeformtext
     *         priceText:string
     *       }
     */
    var SublistLine = /** @class */ (function () {
        /**
         * Note that the sublistId and _line are used by the Sublist decorators to actually implement functionality, even
         * though they are not referenced directly in this class. We mark them as not-enumerable because they are an implementation
         * detail and need not be exposed to the typical consumer
         * @param {string} sublistId netsuite internal id (string name) of the sublist
         * @param {Record} rec netsuite record on which the sublist exists
         * @param {number} _line the line number needed in decorator calls to underlying sublist. That's also why this is
         * public - so that the decorators have access to it.
         */
        function SublistLine(sublistId, rec, _line) {
            this.sublistId = sublistId;
            this._line = _line;
            this.makeRecordProp(rec);
            Object.defineProperty(this, 'sublistId', { enumerable: false });
            Object.defineProperty(this, '_line', { enumerable: false });
        }
        /**
         * Defines a descriptor for nsrecord so as to prevent it from being enumerable. Conceptually only the
         * field properties defined on derived classes should be seen when enumerating
         * @param value
         */
        SublistLine.prototype.makeRecordProp = function (value) {
            Object.defineProperty(this, 'nsrecord', {
                value: value,
                enumerable: false
            });
        };
        // serialize lines to an array with properties shown
        SublistLine.prototype.toJSON = function () {
            var result = {};
            for (var key in this) { // noinspection JSUnfilteredForInLoop
                result[key] = this[key];
            }
            return result;
        };
        return SublistLine;
    }());
    exports.SublistLine = SublistLine;
});
