const sprintf = require('sprintf');
const {
    MONTH_CODE_JANUARY,
} = require('../constants');

module.exports = {

    /**
     * formatDate - Returns a string representation of the the specified
     * date in 'YYYYMMDD' format.
     *
     * @param  {Date} value the string value that should be formated
     *
     * @return {string}       ALWAYS returns an 8-digit string of numbers
     */
    formatDate: (value) => {
        if (value instanceof Date) {
            return sprintf("%4.4s%'02.2s%'02.2s", value.getFullYear(), value.getMonth()+1, value.getDate());
        }
        return sprintf('%8.8s', (value || '').split('-').join(''));
    },

    /**
     * formatAlphanumeric - Converts the specified value to a string containing
     * only uppercase characters and digits.
     *
     * @param  {string} value the string value that should be formated
     * @param  {number} length the string value that should be formated
     * @param  {string} padding the character to pad the specified value with
     *                  (the default is )
     * @param  {boolean} leftJustified whether or not the string should be
     *                  left left-justified or not (the default is false)
     *
     * @return {string}       ALWAYS returns a string containing uppercase
     *                        characters
     */
    formatAlphanumeric: (value, length, padding, leftJustified) => {
        const lenMod = length ? `${length}.${length}` : '';
        const padMod = padding ? `'${padding}` : '';
        const algnMod = leftJustified ? `-` : '';
        return sprintf(`%${padMod}${algnMod}${lenMod}s`, (value || '').toString().toUpperCase());
    },

    /**
    * Returns the specified length of characters with the specified character.
    *
    * @param  {string} char    a character to fill a string
    * @param  {number} length  a length of a string to build
    * @return {string}         a string with specified length of the specified
    *                          character
     */
    formatFill: (char, length) => {
        return sprintf(`%${length}.${length}s`, char);
    },

    /**
     * Returns the alpha representation for the date of a processing cycle,
     * letters A through L (January through December).
     *
     * @param  {Date} value date of processing cycle
     * @return {string}     single uppercase letter representation of the
     *                      processing cycle month
     */
    getMonthCode: (value) => {
        return String.fromCharCode(MONTH_CODE_JANUARY + value.getMonth());
    },


};
