#bin/bash

cd ~/explorer

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js topAddress

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js activeAddress

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js totalAddress

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js nodeBurnCoins

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js knownHashrate

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js infExpired

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js infCreateAndOnline

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js incomeBurnNode

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js incomeBurnAddress

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js totalBurnAddress

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js tx7days

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsFromMongoDB.js hco

sleep 5

/usr/bin/nodejs --stack-size=35000 scripts/statsCountryNodes.js

sleep 5

exit

