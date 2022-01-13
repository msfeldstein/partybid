const { ethers } = require("hardhat");
const WETHABI = require("./weth.abi")
const FoundationABI = require("./foundation.abi")
const ZoraABI = require("./zora.abi")

const wethContract = new ethers.Contract("0x2956356cd2a2bf3202f771f50d3d14a367b48070", WETHABI)
const foundationContract = new ethers.Contract("0xcDA72070E455bb31C7690a170224Ce43623d0B6f", FoundationABI)
const zoraContract = new ethers.Contract("0x90aD9C17f558db2105e2182a8A00A336af5de532", ZoraABI)

module.exports = {
    wethContract,
    foundationContract,
    zoraContract
}