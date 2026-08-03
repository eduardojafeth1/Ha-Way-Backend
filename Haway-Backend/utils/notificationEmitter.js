const EventEmitter = require('events');
const notificationEmitter = new EventEmitter();

// Increase max listeners if needed
notificationEmitter.setMaxListeners(100);

module.exports = notificationEmitter;
