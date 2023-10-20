const {DynamoDBDocumentClient, GetCommand, UpdateCommand} = require('@aws-sdk/lib-dynamodb');
const {DynamoDBClient} = require('@aws-sdk/client-dynamodb');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const {default: axios} = require('axios');
const isNumeric = require('./helpers/get-is-integer');
const getByTagName = require('./helpers/get-by-tag-name');
const InventoryApi = require('./source/index');
const middlewares = require('./middlewares');
const {
  DYNAMO_DB_FETCH_INVENTORY_ERROR,
  NO_STEAMID_PROVIDED,
  INVENTORY_TABLE,
  PRICES_API_URL,
  AWS_REGION,
  ONE_DAY
} = require('./constants');
const getFormattedDate = require('./helpers/get-formatted-date');
const calculateInventoryWithPrices = require('./helpers/calculate-inventory-with-prices');
require('dotenv').config();

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

const client = new DynamoDBClient({region: AWS_REGION});
const docClient = DynamoDBDocumentClient.from(client);

const getCSGOInventory = async ({steamid}) => {
  const inventoryApi = Object.create(InventoryApi);
  const {items} = await inventoryApi.get({appid: 730, contextid: 2, steamid, tradable: false});
  return items;
};

const createCommand = ({steamid}) => new GetCommand({TableName: INVENTORY_TABLE, Key: {steamid}});
const cache = {prices: null, lastUpdated: null};

app.get('/v1/csgoInventory', async (req, res) => {
  const {steamid, steamId} = req.query;
  const now = new Date();

  if (!cache.prices || !cache.lastUpdated || now - cache.lastUpdated > ONE_DAY) {
    try {
      const pricesResp = await axios.get(PRICES_API_URL);
      cache.prices = pricesResp && pricesResp.data && pricesResp.data.items_list;
      cache.lastUpdated = new Date();
    } catch (error) {
      console.error('Prices API fetch error', error);
    }
  }

  const {prices} = cache;

  if (!steamid && !steamId) {
    return res.json({statusCode: 204, inventory: [], description: NO_STEAMID_PROVIDED});
  }

  if (steamId || !isNumeric(steamid)) {
    const command = createCommand({steamid: steamId});

    try {
      const {Item} = await docClient.send(command);
      const {update_time, inventory} = Item;
      const newInventory = prices
        ? JSON.stringify(JSON.parse(inventory).map((item) => ({...item, prices: prices[item.market_hash_name].price})))
        : inventory;

      return res.json({statusCode: 201, inventory: newInventory, update_time});
    } catch (e) {
      console.log(DYNAMO_DB_FETCH_INVENTORY_ERROR);
      return res.json({statusCode: 204, inventory: [], description: DYNAMO_DB_FETCH_INVENTORY_ERROR});
    }
  }

  try {
    const inventory = await getCSGOInventory({steamid});

    const updatedInventory = inventory.map(({assetid, name, market_hash_name, name_color, icon_url, tags}) => {
      const exterior = getByTagName({tags, tagName: 'Exterior'}).localized_tag_name;
      const type = getByTagName({tags, tagName: 'Type'}).localized_tag_name;
      const rarity_color = getByTagName({tags, tagName: 'Rarity'}).color;

      return {type, name, assetid, exterior, icon_url, name_color, market_hash_name, rarity_color};
    });

    const command = new UpdateCommand({
      TableName: INVENTORY_TABLE,
      Key: {steamid},
      UpdateExpression: 'SET inventory=:inventory, update_time=:update_time',
      ExpressionAttributeValues: {':inventory': JSON.stringify(updatedInventory), ':update_time': getFormattedDate()}
    });

    const modifiedInventory = calculateInventoryWithPrices({inventory: updatedInventory, prices});
    await client.send(command);
    return res.status(200).json({statusCode: 200, inventory: JSON.stringify(modifiedInventory)});
  } catch (error) {
    const command = createCommand({steamid});
    try {
      const response = await docClient.send(command);
      if (response.Item && response.Item.inventory) {
        const inventory = JSON.parse(response.Item.inventory);
        const update_time = response.Item.update_time || '';

        const withPrices = calculateInventoryWithPrices({inventory, prices});
        return res.json({statusCode: 201, update_time, inventory: JSON.stringify(withPrices)});
      }
      return res.status(400).json({inventory: [], description: DYNAMO_DB_FETCH_INVENTORY_ERROR});
    } catch (e) {
      console.log(DYNAMO_DB_FETCH_INVENTORY_ERROR);
      return res.json({statusCode: 204, inventory: [], description: DYNAMO_DB_FETCH_INVENTORY_ERROR});
    }
  }
});

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
