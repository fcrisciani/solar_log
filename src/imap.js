// Tell to jslint that this is a node.js program
/*jslint node: true */
'use strict';

var imaps = require('imap-simple');
var elasticsearch = require('elasticsearch');

var log_imap = require('debug')('imap');
var log_es = require('debug')('elastic');

var gmail_password = fs.readFileSync('/run/secrets/gmail_imap', 'utf8', 'r').trim()

var client = new elasticsearch.Client({
  host: process.env.elasticsearch+':9200',
  log: 'warning'
});

var config = {
    imap: {
        user: process.env.email,
        password: gmail_password,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        authTimeout: 3000
    }
};


exports.fetch_mail = function() {
  log_imap('starting imap');

  imaps.connect(config)
  .then(function (connection) {
      log_imap('Connected');
      // connection.imap.getBoxes('', function (err, obj) {
      //     console.log('the error is: ' + err);
      //      console.log(obj);
      //     // console.log(JSON.stringify(obj));
      // });

      var rePattern = new RegExp(/Somma\s+(\d*.\d*) kWh/);

      connection.openBox('Fotovoltaici')
      .then(function () {
        var delay = 24 * 3600 * 1000;
        var yesterday = new Date();
        yesterday.setTime(Date.now() - delay);
        yesterday = yesterday.toISOString();

        var searchCriteria = [
          'UNSEEN'
        ];
        // ['FROM', 'm02c13e6@home1.solarlog-web.it'],
        // ['SUBJECT', 'Sintesi produzione']
        var fetchOptions = {
            bodies: ['HEADER', 'TEXT'],
            markSeen: true
        };

        return connection.search(searchCriteria, fetchOptions)
        .then(function (messages) {
          var es_entries = [];
          messages.forEach(function (message) {
            var a = {};
            a.date = new Date(message.attributes.date);
            //a.date_ts = a.date.getTime() / 1000;
            es_entries.push(a);
            message.parts.forEach(function (part) {
              if (part.which === 'TEXT') {
                a.body = part.body;
              } else if (part.which === 'HEADER') {
                a.subject = part.body.subject[0];
              }
            });
            var arrMatches = a.body.match(rePattern);
            a.kWh = arrMatches[1];
          });
          // imaps.end();
          return es_entries;
        })
        .then(function (entries) {
          //console.log(entries);
          for (var i = entries.length - 1; i >= 0; i--) {
            var elem = entries[i];
            client.index({
              index: 'solar_panels-' + elem.date.getFullYear() + '.' + (elem.date.getMonth()+1),
              type: 'production',
              timestamp: elem.date,
              body: elem
            }, function (error_els, response) {
              if (error_els) {
                log_es('%s there was an error: %s', new Date(), error_els);
              } else {
                log_es('inserted entry for date: %s/%s/%s', elem.date.getFullYear(), elem.date.getMonth()+1, elem.date.getDay()+1);
              }
            });
          }
          // data.crawlingDate = crawling_date.toISOString();
          // client.create({
          //   index: 'lending_club-' + crawling_date.getFullYear() + '-' + crawling_date.getMonth() + '-' + crawling_date.getDay(),
          //   type: 'summary',
          //   body: data
          // }, function (error_els, response) {
          //   if (error_els) {
          //     debug('%s there was an error: %s', new Date(), error_els);
          //   }
          // });
        });
      });
  });
}
