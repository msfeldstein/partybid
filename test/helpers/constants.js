const MARKET_NAMES = {
  ZORA: 'ZORA',
  FOUNDATION: 'FOUNDATION',
};

// MARKETS is an array of all values in MARKET_NAMES
const MARKETS = Object.keys(MARKET_NAMES).map(key => MARKET_NAMES[key]);

const NFT_TYPE_ENUM = {
  ZORA: 0,
  FOUNDATION: 1,
  // NOUNS: 2,
};

const FOURTY_EIGHT_HOURS_IN_SECONDS = 48 * 60 * 60;

const TOKEN_FEE_BASIS_POINTS = 250;
const ETH_FEE_BASIS_POINTS = 250;
const RESALE_MULTIPLIER = 2;
const TOKEN_SCALE = 1000;

const PARTY_STATUS = {
  ACTIVE: 0,
  WON: 1,
  LOST: 2,
};

const ONE_ETH = '1000000000000000000';

module.exports = {
  MARKETS,
  MARKET_NAMES,
  NFT_TYPE_ENUM,
  ONE_ETH,
  PARTY_STATUS,
  FOURTY_EIGHT_HOURS_IN_SECONDS,
  TOKEN_FEE_BASIS_POINTS,
  ETH_FEE_BASIS_POINTS,
  TOKEN_SCALE,
  RESALE_MULTIPLIER
};

