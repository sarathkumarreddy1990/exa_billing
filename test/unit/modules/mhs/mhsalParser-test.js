const chai = require('chai');
const parser = require('../../../../modules/mhs/decoder/index');
const config = require('../../../../server/config');
config.initialize();

describe('Get claims record from manitoba payment file', () => {
    it('should return array of parsed claim data', async () => {
        let fileData = `
000001DIAGNOSTIC SERVICES OF MANITOBA         19344                             
200001900001MANI                PRATHAP        88M7890001191209TL000001000000013
30000100000 20000001910295400101  12345012005{ 900001999       IN      000000013
30000100000 20000001910295400101  12345012007} 900001999       IN      000000013
500001900001MANI                PRATHAP        88M7890001191209TL000001000000013
60000100000     0001910295400101  123450                       IN77    000000013
60000100000     0001910295400101  123458                       IN78    000000013
9USNUM0000012345       00000240000002       00000170000015                      `;
        const data = await parser.processFile(fileData);

        chai.should().exist(data);
    });
});
