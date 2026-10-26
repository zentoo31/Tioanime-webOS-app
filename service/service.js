'use strict';
var Service = require('webos-service');
var client = require('./client');
var provider = require('./provider');
var service = new Service('com.tioanime.tv.catalog');
service.register('page', function (message) {
  client.load(message.payload.path, function (error, html) {
    message.respond(error ? { returnValue: false, errorCode: 1, errorText: error.message } : { returnValue: true, html: html });
  });
});
service.register('probeProvider', function (message) {
  provider.probe(message.payload.url, function (error, result) {
    message.respond(error ? { returnValue: false, errorText: error.message } : { returnValue: true, result: result });
  });
});
// La suscripción mantiene el servicio vivo solo durante la reproducción local.
service.register('holdPlayback', function (message) { message.respond({ returnValue: true, subscribed: true }); });
service.register('images', function (message) {
  var urls = message.payload.urls;
  if (!Array.isArray(urls) || urls.length > 80) { message.respond({ returnValue: false, errorText: 'Lista de imágenes no válida' }); return; }
  require('./jkanime').assets(urls, function (error, assets) { message.respond(error ? { returnValue: false, errorText: error.message } : { returnValue: true, assets: assets }); });
});
