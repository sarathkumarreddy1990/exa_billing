const parser = require('./index');

let data = `                                                                                                                                                                                                     
HYO1910000005390000A    R 2626          000000000            6980190102019102920191029000000000000000000N05BB                                                                                      0   216141095037000820191027X 22   BAPY
HYO1910000005470000A    R 2625          000000000            6980190102019102920191029000000000000000000N05BB                                                                                      0   216141095037000820191027X 22   BAPY
HYO1910000005540000A    H 2626          000000000            6980190102019102920191029000000000000000000N63   63                                                                                   0   216141095037000820191027X 22   BAPY
HYO1910000005620000A    R 2625          000000000            6980190102019102920191029000000000000000000N05BB                                                                                      0   216141095037000820191027X 22   BAPY
HYO1910000005700000A    H 2626          000000000            6980190102019102920191029000000000000000000N63   63                                                                                   0   216141095037000820191027X 22   BAPY
HYO1910000005880000A    R 2625          000000000            6980190102019102920191029000000000000000000N05BB                                                                                      0   216141095037000820191027X 22   BAPY
HYO1910000006380000A    R 2621          99881600070006568011 6980190102019102920191029000000000000000000N39EB 39EB                                                                                 0   216141095037000820191026X 22   BAPY
HYO1910000006460000A    R 2621          99881600070006568011 7980190102019102920191029000000000000000000N39EB 39EB                                                                                 0   216141095037000820191026X 22   RECP
HYO1910000005210000A    H 2622          99881600070006568011 8980190102019102920191029000000000000000000N63                                                                                     0   216141095037000820191026X 22   OTHR`

console.log(parser.parseARDFile(data));