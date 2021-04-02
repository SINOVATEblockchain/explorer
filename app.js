var express = require('express')
  , path = require('path')
  , bitcoinapi = require('bitcoin-node-api')
  , favicon = require('static-favicon')
  , logger = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , settings = require('./lib/settings')
  , routes = require('./routes/index')
  , lib = require('./lib/explorer')
  , db = require('./lib/database')
  , Nodes = require('./models/nodes')
  , locale = require('./lib/locale')
  , request = require('request');

var app = express();

const NodeCache = require('node-cache');
const ttl = 60 * 60 * 1; // cache for 1 Hour
const mycache = new NodeCache({stdTTL: ttl, checkperiod: ttl * 0.2, useClones: false});
const getCacheValue = (key, storeFunction) => {
  const value = mycache.get(key);
  if (value) {
    return Promise.resolve(value);
  }

  return storeFunction().then((result) => {
    mycache.set(key, result);
    return result;
  });
}
// bitcoinapi
bitcoinapi.setWalletDetails(settings.wallet);
if (settings.heavy != true) {
  bitcoinapi.setAccess('only', ['sendrawtransaction','getinfo', 'getnetworkhashps', 'getmininginfo','getdifficulty', 'getconnectioncount',
    'getblockcount', 'getblockhash', 'getblock', 'getrawtransaction', 'getpeerinfo', 'gettxoutsetinfo', 'masternodelist', 'infinitynode']);
} else {
  // enable additional heavy api calls
  /*
    getvote - Returns the current block reward vote setting.
    getmaxvote - Returns the maximum allowed vote for the current phase of voting.
    getphase - Returns the current voting phase ('Mint', 'Limit' or 'Sustain').
    getreward - Returns the current block reward, which has been decided democratically in the previous round of block reward voting.
    getnextrewardestimate - Returns an estimate for the next block reward based on the current state of decentralized voting.
    getnextrewardwhenstr - Returns string describing how long until the votes are tallied and the next block reward is computed.
    getnextrewardwhensec - Same as above, but returns integer seconds.
    getsupply - Returns the current money supply.
    getmaxmoney - Returns the maximum possible money supply.
  */
  bitcoinapi.setAccess('only', ['sendrawtransaction','getinfo', 'getstakinginfo', 'getnetworkhashps', 'getdifficulty', 'getconnectioncount',
    'getblockcount', 'getblockhash', 'getblock', 'getrawtransaction','getmaxmoney', 'getvote',
    'getmaxvote', 'getphase', 'getreward', 'getnextrewardestimate', 'getnextrewardwhenstr',
    'getnextrewardwhensec', 'getsupply', 'gettxoutsetinfo']);
}
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, settings.favicon)));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/api', bitcoinapi.app);
app.use('/', routes);
app.use('/ext/getmoneysupply', function(req,res){
  lib.get_supply(function(supply){
    res.send(' '+supply);
  });
});

app.use('/ext/getaddress/:hash/:txesLimit', function(req,res){
  db.get_address(req.params['hash'], function(address){
    if (address) {
      var count = address.txs.length;
      var hashes = address.txs.reverse();
      var limit = req.params['txesLimit'];
      console.log("getaddress: txesLimit: " + limit);
      var txes = [];
      lib.syncLoop(count, function (loop) {
        var i = loop.iteration();
        db.get_tx(hashes[i].addresses, function(tx) {
          if (tx && (limit == 0 || (limit > 0 && i < limit))) {
            txes.push(tx);
            loop.next();
          } else {
            loop.next();
          }
        });
      }, function(){
        var a_ext = {
          address: address.a_id,
          sent: (address.sent / 100000000),
          received: (address.received / 100000000),
          balance: (address.balance / 100000000).toString().replace(/(^-+)/mg, ''),
          last_txs: txes,
        };
        res.send(a_ext);
      });
    } else {
      res.send({ error: 'address not found.', hash: req.params['hash']})
    }
  });
});

app.use('/ext/coinsview/:hash', function(req,res){
  db.get_stats(settings.coin, function(stats){
    db.get_coins_by_address(req.params['hash'], function(coins){
      if (coins) {
        var balance_spendable = 0, balance_timelocked = 0;
          for(const coin of coins){
            console.log(coin.spendable + " " +coin.spendHeight);
            if(coin.spendable == 1 && coin.spendHeight == 0 && coin.type != "checklocktimeverify"){
              balance_spendable = balance_spendable + parseFloat(coin.value);

            }
            if(coin.spendable == 1 && coin.spendHeight == 0 && coin.type == "checklocktimeverify"){
              balance_timelocked = balance_timelocked + parseFloat(coin.value);
            }
          }
        var c_ext = {
            address: req.params['hash'],
            balanceSpendable: balance_spendable + balance_timelocked,
            spendable: balance_spendable,
            timelocked: balance_timelocked,
            height: stats.count,
            txes: coins
        }
        res.send(c_ext);
      } else {
        res.send({ error: 'address not found.', hash: req.params['hash']})
      }
    });
  });
});

app.use('/ext/getbalance/:hash', function(req,res){
  db.get_address(req.params['hash'], function(address){
    if (address) {
      res.send((address.balance / 100000000).toString().replace(/(^-+)/mg, ''));
    } else {
      res.send({ error: 'address not found.', hash: req.params['hash']})
    }
  });
});

app.use('/ext/getdistribution', function(req,res){
  db.get_richlist(settings.coin, function(richlist){
    db.get_stats(settings.coin, function(stats){
      db.get_distribution(richlist, stats, function(dist){
        res.send(dist);
      });
    });
  });
});

app.use('/ext/getlasttxs/:min', function(req,res){
  db.get_last_txs(settings.index.last_txs, (req.params.min * 100000000), function(txs){
    res.send({data: txs});
  });
});

app.use('/ext/connections', function(req,res){
  db.get_peers(function(peers){
    res.send({data: peers});
  });
});

app.use('/ext/txstats/:height', function(req,res){
  db.get_tx_stats(req.params['height'], function(txstats){
    res.send({data: txstats});
  });
});

app.use('/ext/addressstats', function(req,res){
  db.get_address_stats('count', function(count){
    db.get_address_stats('top', function(top){
      db.get_address_stats('active', function(active){
        res.send({addresses: count.addresses, active: active.active, top10: top.top10, top50: top.top50});
      });
    });
  });
});

app.use('/ext/dashboard', function(req,res){
  db.get_locationnodes(function(get_locationnodes){
    res.send({data: get_locationnodes});
  });
});

app.use('/ext/nodelist', function(req,res){
  db.get_stats(settings.coin, function(stats){
    db.get_infnodes(function(get_nodes){
      res.send({data: get_nodes, height: stats.count});
    });
  });
});



app.use('/ext/nodeexpire', function(req,res){
  db.get_node_expire(function(expire){
    res.send({data: expire});
  });
});

app.use('/ext/hco/:height', function(req,res){
  db.find_hco(req.params['height'],  function(coins){
      res.send({height: req.params['height'], data: coins});
  });
});

app.use('/ext/gettermdepositstats', function(req,res){
  db.get_termdepositstats(function(termdepositstats){
    res.send({"nAddress": termdepositstats[0].term_deposit_wallets, "nTimeLockedTxs": termdepositstats[0].term_deposit_txs, "nTotalTimeLockedValue": termdepositstats[0].term_deposit_total});
  });
});
app.use('/ext/pool-stats', async function (req, res) {
  const axios = require('axios');
  const moment = require('moment');
  const now = moment().unix();
  async function getPoolStats(url) {
    return getCacheValue(url, async () => {
      return await axios.get(url);
    }).then((result) => {
      return result
    })
  }

  const getHashrate = (data, solo) => {
    if (undefined == data.network_hashrate) {
      return !solo ? (data.hashrate/1000000000).toFixed(2)+ ' GH/s' :  (data.hashrate_solo/1000000000).toFixed(2) + ' GH/s';
    } else {
      return !solo ? (data.hashrate/1000000000).toFixed(2)+' GH/s ('+(data.hashrate/data.network_hashrate*100).toFixed(2)+'%)' : (data.hashrate_solo/1000000000).toFixed(2)+' GH/s ('+(data.hashrate_solo/data.network_hashrate*100).toFixed(2)+'%)';
    }
  }
  const mapData = (data, solo=false) => {
    return {
      "pool": data.name,
      "block_height": data.height,
      "workers": !solo ? data.workers : data.workers_solo,
      "blocks_in_24h": !solo ? data['24h_blocks'] : data['24h_blocks_solo'],
      "last_block": !solo ? moment().subtract(data.timesincelast, 'seconds').fromNow() : moment().subtract(data.timesincelast_solo, 'seconds').fromNow(),
      "pool_hashrate": getHashrate(data, solo),
      "history": 100
    }
  }


  const data = [];
  for(const poolName in settings.pools) {
    const solo = !!settings.pools[poolName].solo ? true : false;
    const response = await getPoolStats(settings.pools[poolName].api)
    if (!!response.data) {
      const poolStats = await mapData(response.data.SUQA, solo);
      data.push({
        ...poolStats,
        homepage: settings.pools[poolName].homepage,
        pool_name: settings.pools[poolName].pool_name
      });
    }
  };

  res.send({
    data: data
  });
});

// locals
app.set('title', settings.title);
app.set('symbol', settings.symbol);
app.set('coin', settings.coin);
app.set('locale', locale);
app.set('display', settings.display);
app.set('markets', settings.markets);
app.set('twitter', settings.twitter);
app.set('facebook', settings.youtube);
app.set('googleplus', settings.googleplus);
app.set('youtube', settings.youtube);
app.set('genesis_block', settings.genesis_block);
app.set('index', settings.index);
app.set('heavy', settings.heavy);
app.set('txcount', settings.txcount);
app.set('nethash', settings.nethash);
app.set('nethash_units', settings.nethash_units);
app.set('show_sent_received', settings.show_sent_received);
app.set('logo', settings.logo);
app.set('theme', settings.theme);
app.set('labels', settings.labels);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;
