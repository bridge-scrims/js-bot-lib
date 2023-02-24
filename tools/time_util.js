const moment = require('moment-timezone');
const RESTCountriesClient = require('../apis/countries');

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

class TimeUtil {

    static parseTime(content, now) {
        if (content.toUpperCase().split(' ').some(item => item === 'NOW') && now) 
            return { success: true, value: ((((((now.hours()*60) + now.minutes())*60) + now.seconds())*1000) + now.milliseconds()), hour: now.hour(), minute: now.minute() }

        const time = content.split(':')
        if (time.length !== 2) 
            return { success: false, error: 'Time should be in format `hour`**:**`minute` `(AM/PM)`**!**' };

        let hour = parseInt((time[0].match(/\d/g) || []).join(''))
        if (isNaN(hour)) 
            return { success: false, error: 'The hour must be a number.' };
        if (hour < 0 || hour > 24) 
            return { success: false, error: 'The hour must be a number between 0-24.' };
        
        const isPM = (content.toUpperCase().includes('PM') || content.toUpperCase().includes('P.M'))
        const isAM = (content.toUpperCase().includes('AM') || content.toUpperCase().includes('A.M'))

        if (hour === 12 && isAM) hour += 12;
        if ((hour >= 1 && hour <= 11) && isPM) hour += 12;

        const minute = parseInt((time[1].match(/\d/g) || []).join(''))
        if (isNaN(minute)) 
            return { success: false, error: 'The minute must be a number.' };
        if (minute < 0 || minute > 60) 
            return { success: false, error: 'The minute must be a number between 0-60.' };

        return { success: true, value: (((hour*60)+minute)*60*1000), hour, minute };
    }

    static extractOffset(content) {
        const time = this.parseTime(content)
        if (!time.success) return time;

        const currentTime = ((new Date()).getUTCHours() * 60) + (new Date()).getUTCMinutes()
        const playersTime = (time.value/1000)/60

        let difference = playersTime - currentTime
        if (Math.abs(difference) >= 720) {
            difference = (1440 - Math.abs(difference))
            if (playersTime > currentTime) difference *= -1
        }

        return { success: true, value: ((Math.round(difference / 30) * 30) * -1) };
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