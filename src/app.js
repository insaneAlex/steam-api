const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const {default: axios} = require('axios');
const InventoryApi = require('./source/index');
const isNumeric = require('./helpers/get-is-integer');

require('dotenv').config();

const middlewares = require('./middlewares');
const {DUMMY_INVENTORY} = require('./dummy-inventory');

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
    tradable: false,
  });
  return response.items;
};

const getItemPrice = async ({hashName}) => {
  const getSteamPriceBaseUrl = 'https://steamcommunity.com/market/priceoverview/';

  const currency = 1;
  let response;

  try {
    response = await axios.get(getSteamPriceBaseUrl, {
      params: {
        currency,
        appid,
        market_hash_name: hashName,
      },
    });
  } catch (e) {
    console.log(e);
    response = {e};
  }

  return response.data;
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
    const {median_price} = response;
    return res.json({hashName, price: median_price});
  } catch (e) {
    console.log(e);
    return res.json({desc: 'Something horrible happened', e});
  }
});

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
