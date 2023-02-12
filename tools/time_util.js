const moment = require('moment-timezone');

const Countries = require('../../assets/countries.json')
    .map(country => {
        return {
            'name': country.name,
            'native': country.nativeName,
            'population': country.population,
            'alpha2': country['alpha2Code'],
            'alpha3': country['alpha3Code'],     
            ...Object.fromEntries(Object.entries(country['translations']).filter(([key, value]) => value)),
            ...Object.fromEntries(country.altSpellings.map((v, i) => [`altSpelling_${i}`, v]))
        }
    });

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

class TimeUtil {

    static parseTime(content, now) {
        if (content.toUpperCase().split(' ').some(item => item === 'NOW') && now) 
            return { success: true, value: ((((((now.hours()*60) + now.minutes())*60) + now.seconds())*1000) + now.milliseconds()), hour: now.hour(), minute: now.minute() }

        const time = content.split(':')
        if (time.length !== 2) 
            return { success: false, error: 'Time should be in format \`hour\`**:**\`minute\` \`(AM/PM)\`**!**' };

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

    static parseDate(content, today) {
        today.set('milliseconds', 0).set('seconds', 0).set('minutes', 0).set('hours', 0)
        if (content.toUpperCase().split(' ').some(item => item == 'TODAY')) return { success: true, value: today.valueOf(), day: today.date(), month: today.month(), year: today.year() };
        if (content.toUpperCase().split(' ').some(item => item == 'TOMORROW')) return { success: true, value: today.add(1, 'day').valueOf(), day: today.date(), month: today.month(), year: today.year() };

        const format1 = content.split('/')
        const format2 = content.split('.')
        const date = (format1.length === 3) ? [format1[1], format1[0], format1[2]] : ((format2.length === 3) ? format2 : null)
        if (date === null) return { success: false, error: 'Date should be in format **MM/DD/YYYY** or **DD.MM.YYYY**!' };

        const day = parseInt((date[0].match(/\d/g) || []).join(''))
        if (isNaN(day)) 
            return { success: false, error: 'The day must be a number!' };
        if (day < 1 || day > 31) 
            return { success: false, error: 'The day must be a number between 1-31.' };

        const month = parseInt((date[1].match(/\d/g) || []).join(''))
        if (isNaN(month)) 
            return { success: false, error: 'The month must be a number.' };
        if (month < 1 || month > 12) 
            return { success: false, error: 'The month must be a number between 1-12.' };

        const year = parseInt((date[2].match(/\d/g) || []).join(''))
        if (isNaN(year)) 
            return { success: false, error: 'The year must be a number.' };
        if (year < 0) 
            return { success: false, error: 'The year must be a number greater then 0.' };

        return { success: true, value: (new Date(year, month-1, day)).getTime(), day, month: month-1, year };
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
        if (!offset) return null;
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
            }).filter(([unit, amount]) => amount > 0).slice(0, length).map(([unit, value]) => `**${value}**\`${(value > 1 ? `${unit}s` : unit)}\``)
        if (remainder.length < 1) return '**right now**';
        return (introduce ? 'in ' : '') + (bind ? (remainder.slice(0, -1).join(', ') + ' and ' + remainder.slice(-1)[0]) : remainder.join(' '))
    }

    static parseCountry(value) {
        for (const country of Countries)
            if (Object.values(country).filter(item => typeof item === 'string').map(item => item.toLowerCase()).includes(value.toLowerCase()))
                return country;
        return null;
    }

    static countryZones(country) {
        return moment.tz.zonesForCountry((typeof country === 'object') ? country['alpha2'] : country).map(tz => moment.tz.zone(tz))
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