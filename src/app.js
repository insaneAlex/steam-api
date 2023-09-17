const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const InventoryApi = require('./source/index');
const isNumeric = require('./helpers/get-is-integer');

require('dotenv').config();

const middlewares = require('./middlewares');
const {DUMMY_INVENTORY} = require('./dummy-inventory');

const app = express();

const inventoryApi = Object.create(InventoryApi);

inventoryApi.init({
  id: 'Name of inventoryApi instance',
  proxy: [],
  proxyRepeat: 1,
  maxUse: 25,
  requestInterval: 60 * 1000,
});

const contextid = 2;
const appid = 730;

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

const getCSGOInventory = async (steamid) => {
  const response = await inventoryApi.get({
    appid,
    contextid,
    steamid,
    tradable: false,
  });
  return response.items;
};

app.get('/v1/csgoInventory', async (req, res) => {
  try {
    const {steamid} = req.query;

    if (!isNumeric(steamid)) {
      throw new Error('Invalid Steam ID');
    }

    const inventory = await getCSGOInventory(steamid);
    res.status(200).json({statusCode: 200, inventory});
  } catch (error) {
    const statusCode = error.response && error.response.statusCode ? error.response.statusCode : 201;
    res.status(statusCode).json({statusCode, inventory: DUMMY_INVENTORY});
  }
});

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
