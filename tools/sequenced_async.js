const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 
 * @typedef SequencedFunctionConfig
 * @property {number} [cooldown] Number of seconds to wait between calls.
 * @property {boolean} [merge] If calls coming at the same time should be merged.
 */

/**
 * @template P, R 
 * @param {(...args: P[]) => Promise<R>} call 
 * @param {SequencedFunctionConfig}
 */
function SequencedAsyncFunction(call, { cooldown, merge } = {}) {

    const self = {
        call, cooldown: (cooldown ?? 0) * 1000,
        merge, index: 0
    }

    const run = async (...args) => {

        if (self.lastCall) {
            const diff = Date.now() - self.lastCall
            if (diff < self.cooldown) await sleep(self.cooldown-diff)
        }

        const result = await self.call(...args).catch(error => error)
        self.index -= 1
        self.lastCall = Date.now()
        return result;

    }

    /**
     * @param {...P} args 
     * @returns {Promise<R>}
     */
    return async (...args) => {

        if (self.index > 0 && self.merge) return; 

        self.index += 1
        if (self.running instanceof Promise) {
            self.running = self.running.then(() => run(...args)).catch(() => run(...args))
        }else {
            self.running = run(...args)
        }
        
        return self.running.then(finishUp);

    }

}

function finishUp(value) {
    if (value instanceof Error) throw value;
    return value;
}

module.exports = SequencedAsyncFunction;