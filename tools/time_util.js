const moment = require('moment-timezone');
const RESTCountriesClient = require('../apis/countries');

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const UNITS = { "s": 1, "m": 60, "h": 60*60, "d": 60*60*24, "w": 60*60*24*7, "month": 60*60*24*30, "y": 60*60*24*365 }

class TimeUtil {

    /**
     * @param {RegExp} regexp 
     * @param {[string]} mutableContent 
     */
    static execRemove(regexp, mutableContent) {
        const match = regexp.exec(mutableContent[0])
        if (match) mutableContent[0] = mutableContent[0].replace(match.shift(), '')
        return match
    }
    
    /** 
     * @param {string|[string]} content the regex matches will be removed from the content string so wrap in an array to get those changes
     * @returns {?number} duration as seconds 
     */
    static parseDuration(content) {
        if (typeof content !== 'object') content = [content]
        const seconds = Array.from(content[0].matchAll(/(?:\s|^)([-|+]?\d+|a |an ) *(month|s|m|h|d|w|y)\S*( ago)?/gi))
            .reduce((secs, [match, val, unit, negate]) => {
                content[0] = content[0].replace(match, '')
                return (secs + (parseInt(val) || 1) * UNITS[unit.toLowerCase()] * (negate ? -1 : 1))
            }, 0)
            
        if (Math.abs(seconds) > Number.MAX_SAFE_INTEGER) 
            return Number.MAX_SAFE_INTEGER * (seconds < 0 ? -1 : 1);
        return seconds;
    }

    /** 
     * @param {string|[string]} content the regex matches will be removed from the content string so wrap in an array to get those changes
     * @returns {?moment.Moment} a moment with the given timezone and the parsed hour and minute
     */
    static parseTime(content, tz='UTC') {
        if (typeof content !== 'object') content = [content]
        if (this.execRemove(/(\s|^)(now|rn)(\s|$)/i, content)) return moment.tz(tz);

        const time = this.execRemove(/(?:\s|^)(\d{1,2})(:\d{1,2})? *(a.?m.?|p.?m.?|\s|$)/i, content)
        if (!time) return null;

        if (time[2]?.toLowerCase()?.includes('p') && time[0] >= 1 && time[0] <= 11) time[0] = parseInt(time[0]) + 12
        if (time[2]?.toLowerCase()?.includes('a') && time[0] === 12) time[0] = 24
        if (time[1]) time[1] = time[1].slice(1)

        const [h, m, _] = time
        return moment.tz(tz).hour(parseInt(h)).minute(parseInt(m) || 0);
    }

    /** 
     * @param {string|[string]} content the regex matches will be removed from the content string so wrap in an array to get those changes
     * @returns {?moment.Moment} a moment with the given timezone and the parsed year, month and date
     */
    static parseDate(content, tz='UTC') {
        if (typeof content !== 'object') content = [content]
        if (this.execRemove(/(\s|^)(today|tdy)(\s|$)/i, content)) return moment.tz(tz);
        if (this.execRemove(/(\s|^)(tomorrow|tmr)(\s|$)/i, content)) return moment.tz(tz).add(1, 'day');
    
        const date = this.execRemove(/(\d{1,2})([.|/])(\d{1,2})?[.|/]?(\d{2,4})?/i, content) 
        if (!date) return null;
    
        if (!date[2]) date[2] = moment.tz(tz).month() + 1
        if (!date[3]) date[3] = moment.tz(tz).year()

        if (date[1] === '/') [date[0], date[2]] = [date[2], date[0]]
        if (date[3].length <= 2) date[3] = `${moment.tz(tz).year()}`.slice(0, 2) + date[3]
        
        const [d, _, m, y] = date;
        return moment.tz(tz).year(parseInt(y)).month(parseInt(m) - 1).date(parseInt(d));
    }
    
    static extractOffset(content) {
        const time = this.parseTime(content)
        if (!time) return null;

        const currentTime = ((new Date()).getUTCHours() * 60) + (new Date()).getUTCMinutes()
        const playersTime = (time.hours() * 60) + time.minutes()

        let difference = playersTime - currentTime
        if (Math.abs(difference) >= 720) {
            difference = (1440 - Math.abs(difference))
            if (playersTime > currentTime) difference *= -1
        }

        return ((Math.round(difference / 30) * 30) * -1);
    }

    static resolveTZ(resolvable) {
        if (!resolvable) return null;
        if (resolvable?.constructor?.name === 'Object')
            return moment.tz.zone(resolvable.name);
        if (moment.tz.names().includes(resolvable))
            return moment.tz.zone(resolvable);
        return null;
    }
    
    static getTime(dateTime, timezone='UTC') {
        if (moment.isMoment(dateTime)) return dateTime;
        if (typeof dateTime === 'string') dateTime = parseInt(dateTime)
        if (dateTime instanceof Date) dateTime = dateTime.getTime()
        if (typeof timezone === 'number')
            return moment.tz(dateTime, 'UTC').add(timezone*-1, 'minutes');

        timezone = this.resolveTZ(timezone)
        if (timezone) return moment.tz(dateTime, timezone.name);
        return null;
    }

    static getOffset(value) {
        if (typeof value === 'number') return value;
        const timezone = this.resolveTZ(value)
        if (timezone) return timezone.utcOffset(Date.now());
        return null;
    }

    static stringifyOffset(value) {
        const offset = this.getOffset(value) * -1
        if (!offset) return `±00:00`;
        return ((offset < 0) ? '-' : '+')
                + (`${Math.abs(Math.floor(offset/60)).toString().padStart(2, '0')}:${Math.abs(offset % 60).toString().padStart(2, '0')}`);
    }

    static stringifyDifference(diff, length=2, introduce=false, bind=false) {
        const layers = { year: 1, month: 12, week: 4.345, day: 7, hour: 24, minute: 60, second: 60, millisecond: 1000 };
        const remainder = Object.keys(layers)
            .slice(0, -1).map(unit => {
                const value = Object.values(layers).filter((v, index) => index > Object.keys(layers).indexOf(unit)).reduce((pv, cv) => pv * cv, 1)
                const amount = Math.round(diff / value)
                diff -= (amount * value)
                return [unit, amount];
            }).filter(([_, amount]) => amount > 0).slice(0, length).map(([unit, value]) => `**${value}**\`${(value > 1 ? `${unit}s` : unit)}\``)
        if (remainder.length < 1) return '**right now**';
        return (introduce ? 'in ' : '') + (bind ? (remainder.slice(0, -1).join(', ') + ' and ' + remainder.slice(-1)[0]) : remainder.join(' '))
    }

    /** @param {import('../apis/countries').Country} country */
    static getCountryAliases(country) {
        /** @param {import('../apis/countries').NameData} d */
        const from_name_data = (d) => [d?.common, d?.official]
        return [
            country.cca2, country.cca3, country.ccn3,
            ...Object.values(country.name.nativeName || {}).map(from_name_data).flat(),
            ...from_name_data(country.name), ...country.altSpellings,
            ...Object.values(country.translations).map(from_name_data).flat()
        ].filter(v => typeof v === 'string')
    }

    static parseCountry(value) {
        for (const country of RESTCountriesClient.Countries)
            if (this.getCountryAliases(country).map(item => item.toLowerCase()).includes(value.toLowerCase()))
                return country;
        return null;
    }

    static countryZones(country) {
        return moment.tz.zonesForCountry((typeof country === 'object') ? country.cca2 : country)?.map(tz => moment.tz.zone(tz)) || []
    }

    static countryOffsets(country) {
        return [...new Set(this.countryZones(country).map(tz => tz.utcOffset(Date.now())))];
    }

    static countryTimes(country) {
        return [...new Set(this.countryZones(country).map(tz => `${this.getTime(Date.now(), tz).format('HH:mm')} (UTC ${this.stringifyOffset(tz)})`))];
    }

    static offsetCountries(offset) {
        return [
            ...new Set(moment.tz.countries()
                .filter(country => this.countryZones(country).filter(tz => tz.utcOffset(Date.now()) === offset).length > 0)
                .map(country => this.parseCountry(country))
                .filter(country => country !== null)
            )
        ];
    }

    static getTimeZone(name) {
        if (moment.tz.names().includes(name))
            return moment.tz.zone(name);
        return null;
    }

    static resolveZone(country, offset) {
        const populations = Object.fromEntries(
            this.countryZones(country)
                .filter(tz => tz.utcOffset(Date.now()) === offset)
                .map(tz => [tz.population, tz])
        )
        return populations[Math.max(...Object.keys(populations))];
    }

}

module.exports = TimeUtil;