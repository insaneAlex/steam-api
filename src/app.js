const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const InventoryApi = require('./source/index');

require('dotenv').config();

const middlewares = require('./middlewares');

const app = express();

const inventoryApi = Object.create(InventoryApi);

const isNumeric = (str) => {
  if (typeof str !== 'string') return false;
  return !Number.isNaN(str) && !Number.isNaN(parseFloat(str));
};

inventoryApi.init({
  id: 'Name of inventoryApi instance',
  proxy: [],
  proxyRepeat: 1,
  maxUse: 25,
  requestInterval: 60 * 1000
});

const contextid = 2;
const appid = 730;

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
  const {steamid} = req.query;
  const isNum = isNumeric(steamid);

  let inventory = {steamid, isNum};

  if (steamid && isNum) {
    inventory = await inventoryApi
      .get({
        appid,
        contextid,
        steamid,
        tradable: false
      })
      .then(({items}) => items)
      .catch((err) => {
        if (err.statusCode === 429) {
          console.log('Too many requests, try again later.');
        }
      });
  }

  res.json(inventory);
});

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
