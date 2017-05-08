// Tell to jslint that this is a node.js program
/*jslint node: true */
'use strict';

var log = require('debug')('main');
var imap = require('./imap.js');

imap.fetch_mail();

// repeat the operation every 12 hours
setInterval(imap.fetch_mail, 12 * 3600 * 1000);

log('Application started');
