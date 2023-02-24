const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const got = require('got');

const COUNTRIES_PATH = path.join(__dirname, 'cache', 'countries.json')
const SERVER = 'restcountries.com/v3.1'
const TIMEOUT = 5000

/** @type {Country[]} */
let countries = []

const hash = crypto.createHash('sha256')
if (fs.existsSync(COUNTRIES_PATH)) {
    const content = fs.readFileSync(COUNTRIES_PATH, 'utf-8')
    hash.update(content)
    countries = JSON.parse(content)
}

class RESTCountriesClient {
    
    static get Countries() {
        return countries;
    }

    /**
     * @protected
     * @returns {Promise<import('got').Response<Object.<string, any>>>}
     */
    static async request(path) {
        const url = `https://${SERVER}/${path.join("/")}`
        const response = await got(url, { timeout: TIMEOUT, responseType: 'json', retry: 0, cache: false })
        return response;
    }

    /** @returns {Promise<Country[]>} */
    static async fetchAll() {
        const response = await this.request(["all"])
        return response.body;
    }

}

async function updateCountries(newCountries) {
    const content = JSON.stringify(newCountries)
    const newDigest = crypto.createHash('sha256').update(content).digest()
    if (!hash.digest().equals(newDigest)) {
        console.log("New Countries Found!")
        countries = newCountries
        await fs.promises.writeFile(COUNTRIES_PATH, content)
    }
}

// Try and update the countries file but don't kill the program if this fails
console.log("Checking for new Countries...")
RESTCountriesClient.fetchAll()
    .then(updateCountries).catch(err => console.error(`Failed to fetch Countries (${err})`))

/**
 * @typedef NameData
 * @prop {string} common
 * @prop {string} official
 * 
 * @typedef CountryNameData
 * @prop {Object<string, NameData>} nativeName
 * 
 * @typedef FlagData
 * @prop {string} png
 * @prop {string} svg
 * @prop {string} alt
 * 
 * @typedef Country
 * @prop {NameData & CountryNameData} name
 * @prop {string} cca2
 * @prop {string} cca3
 * @prop {string} ccn3
 * @prop {string[]} altSpellings
 * @prop {Object<string, NameData>} translations
 * @prop {number} population
 * @prop {FlagData} flag
 */

module.exports = RESTCountriesClient;