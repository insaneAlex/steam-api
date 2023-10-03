const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

const market = require('steam-market-pricing');
const {SteamMarketParser} = require('steam-market-parser');

const InventoryApi = require('./source/index');
const isNumeric = require('./helpers/get-is-integer');
require('dotenv').config();
const middlewares = require('./middlewares');
const {DUMMY_INVENTORY} = require('./dummy-inventory');
const {LAST_PRICES} = require('./dummy-prices');

const app = express();

const contextid = 2;
const appid = 730;

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

const getCSGOInventory = async ({steamid}) => {
  const inventoryApi = Object.create(InventoryApi);

  const response = await inventoryApi.get({
    appid,
    contextid,
    steamid,
    tradable: false
  });
  return response.items;
};

const getItemPrice = async ({hashName}) => {
  const smParser = new SteamMarketParser();
  let response;
  try {
    response = await smParser.getMarketData(hashName);
    console.log(response);
    return response;
  } catch (e) {
    console.log(e);
    response = {e};
    return response;
  }
};

const getPrices = async ({names}) => {
  let response;
  const filteredNames = [];

  names.forEach((name) => {
    if (!Object.keys(LAST_PRICES).includes(name)) {
      filteredNames.push(name);
    }
  });

  try {
    if (filteredNames.length > 0) {
      response = await market.getItemsPrices(730, filteredNames).then((items) => items);
    } else {
      response = {e: new Error('no items without price')};
    }

    console.log(response);
  } catch (e) {
    console.log(e);
    response = {e};
  }

  return response;
};

app.get('/v1/csgoInventory', async (req, res) => {
  const {steamid} = req.query;

  if (!isNumeric(steamid)) {
    return res.json({inventory: DUMMY_INVENTORY});
  }

  try {
    const inventory = await getCSGOInventory({steamid});
    return res.status(200).json({statusCode: 200, inventory});
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({inventory: DUMMY_INVENTORY, error});
    }
    return res.json({inventory: DUMMY_INVENTORY, error});
  }
});

app.get('/v1/itemPrice', async (req, res) => {
  const {hashName} = req.query;

  try {
    const response = await getItemPrice({hashName});

    return res.json({hashName, priceHistory: response.priceHistory});
  } catch (e) {
    console.log(e);
    return res.json({desc: 'Something horrible happened', e});
  }
});

app.post('/v1/prices', async (req, res) => {
  const names = req.body;
  try {
    const response = await getPrices({names});
    console.log(response);
    return res.json(response);
  } catch (e) {
    console.log(e);
    return res.json({desc: 'Something horrible happened', e});
  }
});

app.get('/v1/prices', async (req, res) => res.json(LAST_PRICES));

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
