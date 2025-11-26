"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllHandlers = registerAllHandlers;
const mainMenu_1 = require("./mainMenu");
const photoAnimation_1 = require("./photoAnimation");
const musicCreation_1 = require("./musicCreation");
const profile_1 = require("./profile");
const payment_1 = require("./payment");
const textHandlers_1 = require("./textHandlers");
function registerAllHandlers(bot, userStates) {
    (0, mainMenu_1.registerMainMenuHandlers)(bot, userStates);
    (0, photoAnimation_1.registerPhotoAnimationHandlers)(bot, userStates);
    (0, musicCreation_1.registerMusicCreationHandlers)(bot, userStates);
    (0, profile_1.registerProfileHandlers)(bot, userStates);
    (0, payment_1.registerPaymentHandlers)(bot, userStates);
    (0, textHandlers_1.registerTextHandlers)(bot, userStates);
}
