
/**
 * const collapseNumberToDigit - adds the digits in a 2-digit number. So '1'
 * stays 1, '6' stays 6, '12' becomes 3, '17' becomes 8, etc etc. This function
 * is NOT recursive, so '38' becomes 11, '49' becomes 13, etc etc.
 *
 * Based on algorithm from section 4.14 of OHIP v3 technical specification
 *
 * @param  {string} numberStr a two character string of digits
 * @return {int}              a single digit sum of the digits in numberStr
 */
const collapseNumberToDigit = (numberStr) => {
    return parseInt(numberStr.charAt(0)) + parseInt(numberStr.charAt(1) || '0');
};

module.exports = {

    /**
     * isValidHealthNumber - determines if the format of the Health Number is valid.
     * Based on the algorithm from section 4.14 of OHIP v3 technical specifiction.
     *
     * @param  {string} healthNumber description
     * @return {boolean}            description
     */
    isValidHealthNumber: (healthNumber) => {

        let nonCheckDigitSum = 0;
        let healthNumberStr = healthNumber.toString();

        for (let digitPos = 1; digitPos < 10; digitPos++) {

            let digitValue = healthNumberStr.charAt(digitPos - 1);

            if (digitPos % 2) {
                // for odd digit positions, double the value, then add digits in new value
                nonCheckDigitSum += collapseNumberToDigit((2 * (digitValue)).toString());
            }
            else {
                nonCheckDigitSum += parseInt(digitValue);
            }
        }
        return parseInt(healthNumberStr.charAt(9)) === parseInt((nonCheckDigitSum * 9) % 10);
    },
}
