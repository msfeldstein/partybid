const { ethers } = require("hardhat");
const WETHABI = require("./weth.abi")
const FoundationABI = require("./foundation.abi")

const weth = new ethers.Contract("0x2956356cd2a2bf3202f771f50d3d14a367b48070", WETHABI)
const foundation = new ethers.Contract("0xcDA72070E455bb31C7690a170224Ce43623d0B6f", FoundationABI)

module.exports = {
    weth,
    foundation
}