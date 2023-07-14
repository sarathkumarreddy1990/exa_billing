'use strict';

const finalizeText = text => {
    return text
        .replace(/'|¢|\[|\]/g, ` `)    // Replace with a space to keep field sizes correct
        .toUpperCase();                 // AHS requires all uppercase for the whole file
};

module.exports = {
    finalizeText,
}
