const BinPool = artifacts.require("BinPool");
const BinGov = artifacts.require("BinGov");
const BinAttack = artifacts.require("BinAttack");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(BinPool);
  await deployer.deploy(BinGov, BinPool.address);
  await deployer.deploy(BinAttack, BinPool.address);

  const binPool = await BinPool.deployed();
  await binPool.setBinGov(BinGov.address);

  if (network !== "test") {
    const seedGovernance = "0xA596582aA36C24b9985fea95013d48D8F75DdA5d"; // Used until BinGov is sufficiently decentralized
    await binPool.changeGovernance(seedGovernance);
  }
};
