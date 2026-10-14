'use strict';
var Service = require('webos-service');
var client = require('./client');
var service = new Service('com.tioanime.tv.catalog');
service.register('page', function (message) {
  client.load(message.payload.path, function (error, html) {
    message.respond(error ? { returnValue: false, errorCode: 1, errorText: error.message } : { returnValue: true, html: html });
  });
});
