class ColorUtil {

    /** 
     * If s = v = 1 than h = 120 is green and h = 0 is red 
     */
    static hsv2rgb(h, s, v) {
        const i = Math.floor((h/360)*6)
        const a = v * (1 - s)
        const b = v * (1 - s * ((h/360)*6 - i))
        const c = v * (1 - s * (1 - ((h/360)*6 - i)))
    
        const values = (() => {
            if (i === 0) return [ v, c, a ];
            if (i === 1) return [ b, v, a ];
            if (i === 2) return [ a, v, c ];
            if (i === 3) return [ a, b, v ];
            if (i === 4) return [ c, a, v ];
            if (i === 5) return [ v, a, b ];
        })()
    
        return values.map(v => Math.round(v*255));
    }

}

module.exports = ColorUtil;