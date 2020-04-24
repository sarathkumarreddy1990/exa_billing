const chai = require('chai');
const parser = require('../../../../modules/ahs/decoder/index');
const config = require('../../../../server/config');
config.initialize();

describe('Get claims record from ARD file', () => {
  it('should return array of parsed claim data', async () => {
    let fileData = `
H-link  :STX  ***  Input Data Set: HMCT.XAOHHYO.INPUT.BACKUP.G0006V00  ***      
                                                                                
                                 ALBERTA HEALTH                                 
                                Claims Assessment                               
                                  Batch Results                                 
                                                       Date : 2019/10/16        
                                                                                
Batch       First Transaction    Last Transaction     Status     Reason         
Number      ID                   ID                   Code       Code           
                                                                                
HYO000010   HYO1805     150      HYO1805     150      PART       TX             
                                                                                
H-link  :ETX     More data follows? Y                                           
22019/10/16 15:22:09.600000 0006 HEADER                                         
3HYO1805     150CIP1CIB10000A      34DC                                         
3HYO1805     150CIP1CPD10000A                                                   
3HYO1805     150CIP1CPD10000A                                                   
4000000001000000003     TRAILER`;

    const data = await parser.parseBatchBalanceFile(fileData);
    chai.should().exist(data);
  });
});