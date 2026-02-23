const ChainNotes = artifacts.require("ChainNotes");

module.exports = function (deployer) {
  deployer.deploy(ChainNotes);
};
