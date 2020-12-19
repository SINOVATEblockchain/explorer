var mongoose = require('mongoose')
  , lib = require('../lib/explorer')
  , db = require('../lib/database')
  , Tx = require('../models/tx')
  , Inf = require('../models/infnodes')
  , settings = require('../lib/settings')
  , request = require('request');

mongoose.set('useCreateIndex', true);

var COUNT = 5000; //number of blocks to index

function exit() {
  mongoose.disconnect();
  process.exit(0);
}

var dbString = 'mongodb://' + settings.dbsettings.user;
dbString = dbString + ':' + settings.dbsettings.password;
dbString = dbString + '@' + settings.dbsettings.address;
dbString = dbString + ':' + settings.dbsettings.port;
dbString = dbString + '/' + settings.dbsettings.database;

mongoose.connect(dbString,{ useNewUrlParser: true, useUnifiedTopology: true }, function(err) {
  if (err) {
    console.log('Unable to connect to database: %s', dbString);
    console.log('Aborting');
    exit();
  } else {
   Inf.remove({}, function(err){
    if(err){
       console.log('ERROR delete blog');
       exit();
    }
    lib.get_infinitynode(function(infnodes){
      const keys = Object.keys(infnodes);
      lib.syncLoop(keys.length, function (loop) {
        var i = loop.iteration();
        var burntx = keys[i];
        const lineData = infnodes[keys[i]].split(" ");
        const noEmptyData = [];
        for (var j = 0; j < lineData.length; j++) {
          if (lineData[j].length !== 0) {
            noEmptyData.push(lineData[j]);
          }
       }
       var ip="0.0.0.0";
       var publickey="";
       var splitString = noEmptyData[11].split(':');
       if (noEmptyData[11] != "[::]:0"){
           if (splitString[splitString.length -1] == '20970' || splitString[splitString.length -1] == '20980') {
             if (noEmptyData[11].substring(0,1) == '[' && noEmptyData[11].substring(noEmptyData[11].length - 7, noEmptyData[11].length - 6) == ']') {
               ip = noEmptyData[11].substring(1, noEmptyData[11].length - 7)
             } else { ip = noEmptyData[11].substring(0, noEmptyData[11].length - 6); }
           }
           if (splitString[splitString.length -1] == '0') {
             ip = noEmptyData[11].substring(0, noEmptyData[11].length - 2);
           }
       }
       if (noEmptyData[10] != "NodeAddress"){
              publickey = noEmptyData[10];
       }

        db.find_infnode(burntx, function(node) {
          if(node){
            // node already exists => check update
            console.log("Existe: " + burntx);
            if (node.last_stm_size != noEmptyData[8] ||
                node.last_paid != noEmptyData[6] ||
                (node.ip != ip && ip != "0.0.0.0")
               )
            {
              if (node.ip != ip && ip != "0.0.0.0"){
                  console.log("Update last paid or last statement size or IP change");
                  Inf.updateOne({burntx: burntx}, {
                                last_paid: noEmptyData[6],
                                last_stm_size: noEmptyData[8],
                                ip: ip,
                                country: "",
                  }, function() {loop.next();});
              }else{
                  console.log("Update last paid or last statement size");
                  Inf.updateOne({burntx: burntx}, {
                                last_paid: noEmptyData[6],
                                last_stm_size: noEmptyData[8],
                  }, function() {loop.next();});
              }
            } else {
              console.log("Nothing to update");
              loop.next();
            }
          } else {
            // node does not exist => create new node
            console.log("Add: ip: " + ip + " port:" + splitString[splitString.length -1] + ", id"  + burntx);
            db.create_infnode({
              burntx: burntx,
              address: noEmptyData[0],
              start_height: noEmptyData[1],
              expired_height: noEmptyData[2],
              burnvalue: noEmptyData[3],
              type: noEmptyData[4],
              address_backup: noEmptyData[5],
              last_paid: noEmptyData[6],
              rank: noEmptyData[7],
              last_stm_size: noEmptyData[8],
              publickey: publickey,
              ip: ip,
            }, function(){
              loop.next();
            });
          }
        });
      }, function() {
        exit();
      });
    });
   });
  }// end else
});

