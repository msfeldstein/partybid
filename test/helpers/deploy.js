const {
  eth,
  approve,
  createReserveAuction,
  createZoraAuction,
} = require('./utils');
const { MARKET_NAMES, FOURTY_EIGHT_HOURS_IN_SECONDS } = require('./constants');
const { upgrades } = require('hardhat');
const {foundationContract, wethContract, zoraContract} = require('../external/contracts');

async function deploy(name, args = []) {
  const Implementation = await ethers.getContractFactory(name);
  const contract = await Implementation.deploy(...args);
  return contract.deployed();
}

async function getTokenVault(party, signer) {
  const vaultAddress = await party.tokenVault();
  const TokenVault = await ethers.getContractFactory('TokenVault');
  return new ethers.Contract(vaultAddress, TokenVault.interface, signer);
}

  async function deployFoundationAndStartAuction(
    artistSigner,
    nftContract,
    tokenId,
    reservePrice,
  ) {
    // Deploy Foundation treasury & NFT market
    const foundationMarket = foundationContract.connect(artistSigner.provider)

    // Deploy Market Wrapper
    const marketWrapper = await deploy('FoundationMarketWrapper', [
      foundationMarket.address,
    ]);

    // Approve NFT Transfer to Foundation Market
    await approve(artistSigner, nftContract, foundationMarket.address, tokenId);

    // Create Foundation Reserve Auction
    await createReserveAuction(
      artistSigner,
      foundationMarket,
      nftContract.address,
      tokenId,
      eth(reservePrice),
    );
    const auctionId = await foundationMarket.connect(artistSigner).getReserveAuctionIdFor(nftContract.address, tokenId);
    return {
      market: foundationMarket,
      marketWrapper,
      auctionId: auctionId.toNumber(),
    };
  }

  async function deployZoraAndStartAuction(
    artistSigner,
    nftContract,
    tokenId,
    weth,
    reservePrice,
  ) {
    // Deploy Zora Auction House
    const zoraAuctionHouse = zoraContract.connect(artistSigner.provider)

    // Deploy Market Wrapper
    const marketWrapper = await deploy('ZoraMarketWrapper', [
      zoraAuctionHouse.address,
    ]);

    // Approve NFT Transfer to Market
    await approve(artistSigner, nftContract, zoraAuctionHouse.address, tokenId);

    // Create Zora Auction
    await createZoraAuction(
      artistSigner,
      zoraAuctionHouse,
      tokenId,
      nftContract.address,
      eth(reservePrice),
    );

    // Since we're forking from mainnet we need to get the logs for the auctionId that gets 
    // created since its not always 0
    const logs = await artistSigner.provider.getLogs({ address: zoraAuctionHouse.address });
    // parse events from logs
    const events = logs.map((log) => zoraAuctionHouse.interface.parseLog(log));
    const auctionId = events[0].args.auctionId.toNumber()

    return {
      market: zoraAuctionHouse,
      marketWrapper,
      auctionId,
    };
  }

  async function deployNounsAndStartAuction(
    nftContract,
    tokenId,
    weth,
    reservePrice,
    pauseAuctionHouse,
  ) {
    const TIME_BUFFER = 5 * 60;
    const MIN_INCREMENT_BID_PERCENTAGE = 5;

    // Deploy Nouns Auction House
    const auctionHouseFactory = await ethers.getContractFactory('NounsAuctionHouse');
    const nounsAuctionHouse = await upgrades.deployProxy(auctionHouseFactory, [
      nftContract.address,
      weth.address,
      TIME_BUFFER,
      eth(reservePrice),
      MIN_INCREMENT_BID_PERCENTAGE,
      FOURTY_EIGHT_HOURS_IN_SECONDS,
    ]);

    // Set Nouns Auction House as minter on Nouns NFT contract
    await nftContract.setMinter(nounsAuctionHouse.address);

    // Deploy Market Wrapper
    const marketWrapper = await deploy('NounsMarketWrapper', [
      nounsAuctionHouse.address,
    ]);

    // Start auction
    await nounsAuctionHouse.unpause();

    // If true, pause the auction house after the first Noun is minted
    if (pauseAuctionHouse) {
      await nounsAuctionHouse.pause();
    }

    const { nounId } = await nounsAuctionHouse.auction();

    return {
      market: nounsAuctionHouse,
      marketWrapper,
      auctionId: nounId.toNumber(),
    };
  }

  async function deployTestContractSetup(
    marketName,
    provider,
    artistSigner,
    splitRecipient,
    splitBasisPoints,
    reservePrice,
    tokenId,
    fakeMultisig = false,
    pauseAuctionHouse = false,
    gatedToken = "0x0000000000000000000000000000000000000000",
    gatedTokenAmount = 0
  ) {
    // Deploy WETH
    // const weth = weth
    const weth = wethContract.connect(provider)
    // Deploy the test nft contract
    let nftContract = await deploy('TestERC721', []);
    // Mint token to artist
    await nftContract.mint(artistSigner.address, tokenId);

    // Deploy Market and Market Wrapper Contract + Start Auction
    let marketContracts;
    if (marketName == MARKET_NAMES.FOUNDATION) {
      marketContracts = await deployFoundationAndStartAuction(
        artistSigner,
        nftContract,
        tokenId,
        reservePrice,
      );
    } else if (marketName == MARKET_NAMES.ZORA) {
      marketContracts = await deployZoraAndStartAuction(
        artistSigner,
        nftContract,
        tokenId,
        weth,
        reservePrice,
      );
    } else if (marketName == MARKET_NAMES.NOUNS) {
      marketContracts = await deployNounsAndStartAuction(
        nftContract,
        tokenId,
        weth,
        reservePrice,
        pauseAuctionHouse,
      )
    } else {
      throw new Error('Unsupported market type');
    }

    const { market, marketWrapper, auctionId } = marketContracts;

    // Deploy PartyDAO multisig
    let partyDAOMultisig;
    if(!fakeMultisig) {
      partyDAOMultisig = await deploy('PayableContract');
    } else {
      partyDAOMultisig = artistSigner;
    }

    const tokenVaultSettings = await deploy('Settings');
    const tokenVaultFactory = await deploy('ERC721VaultFactory', [
      tokenVaultSettings.address,
    ]);

    // Deploy PartyBid Factory (including PartyBid Logic + Reseller Whitelist)
    const factory = await deploy('PartyBidFactory', [
      partyDAOMultisig.address,
      tokenVaultFactory.address,
      weth.address
    ]);

    // Deploy PartyBid proxy
    await factory.startParty(
      marketWrapper.address,
      nftContract.address,
      tokenId,
      auctionId,
      [splitRecipient, splitBasisPoints],
      [gatedToken, gatedTokenAmount],
      'Parrrrti',
      'PRTI',
    );

    // Get PartyBid ethers contract
    const partyBid = await getPartyBidContractFromEventLogs(
      provider,
      factory,
      artistSigner,
    );

    return {
      nftContract,
      market,
      marketWrapper,
      partyBid,
      partyDAOMultisig,
      weth,
      factory
    };
  }

  async function getPartyBidContractFromEventLogs(
    provider,
    factory,
    artistSigner,
  ) {
    // get logs emitted from PartyBid Factory
    const logs = await provider.getLogs({ address: factory.address });

    // parse events from logs
    const PartyBidFactory = await ethers.getContractFactory('PartyBidFactory');
    const events = logs.map((log) => PartyBidFactory.interface.parseLog(log));

    // extract PartyBid proxy address from PartyBidDeployed log
    const partyBidProxyAddress = events[0]['args'][0];

    // instantiate ethers contract with PartyBid Logic interface + proxy address
    const PartyBid = await ethers.getContractFactory('PartyBid');
    const partyBid = new ethers.Contract(
      partyBidProxyAddress,
      PartyBid.interface,
      artistSigner,
    );
    return partyBid;
  }

  module.exports = {
    deployTestContractSetup,
    deploy,
    getTokenVault,
  };
