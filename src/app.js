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
require('dotenv').config();

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

const FETCH_PRICES_URL = 'http://csgobackpack.net/api/GetItemsList/v2/';
const AWS_REGION = 'eu-central-1';
const INVENTORY_TABLE = 'inventories';

const client = new DynamoDBClient({region: AWS_REGION});
const docClient = DynamoDBDocumentClient.from(client);

const getCSGOInventory = async ({steamid}) => {
  const inventoryApi = Object.create(InventoryApi);
  const {items} = await inventoryApi.get({appid: 730, contextid: 2, steamid, tradable: false});
  return items;
};

const createCommand = ({steamid}) => new GetCommand({TableName: INVENTORY_TABLE, Key: {steamid}});

app.get('/v1/csgoInventory', async (req, res) => {
  const {steamid, steamId} = req.query;

  if (!steamid && !steamId) {
    return res.json({statusCode: 202, inventory: []});
  }

  if (steamId || !isNumeric(steamid)) {
    const command = createCommand({steamid: steamId});

    try {
      const {Item} = await docClient.send(command);
      const responsePrices = await axios.get(FETCH_PRICES_URL);
      const prices = responsePrices && responsePrices.data && responsePrices.data.items_list;
      const {update_time, inventory} = Item;

      const withPrices = JSON.parse(inventory).map((item) => ({...item, prices: prices[item.market_hash_name].price}));

      return res.json({statusCode: 201, inventory: JSON.stringify(withPrices), update_time});
    } catch (e) {
      return console.log(e);
    }
  }

  try {
    const responsePrices = await axios.get(FETCH_PRICES_URL);
    const prices = responsePrices && responsePrices.data && responsePrices.data.items_list;
    const inventory = await getCSGOInventory({steamid});

    const updatedInventory = inventory.map(({assetid, name, market_hash_name, name_color, icon_url, tags}) => {
      const exterior = getByTagName({tags, tagName: 'Exterior'}).localized_tag_name;
      const type = getByTagName({tags, tagName: 'Type'}).localized_tag_name;
      const rarity = getByTagName({tags, tagName: 'Rarity'}).color;

      return {
        type,
        name,
        assetid,
        exterior,
        icon_url,
        name_color,
        market_hash_name,
        rarity_color: rarity
      };
    });

    const update_time = new Intl.DateTimeFormat('en-GB', {dateStyle: 'long', timeStyle: 'medium'}).format(new Date());
    const command = new UpdateCommand({
      TableName: INVENTORY_TABLE,
      Key: {steamid},
      UpdateExpression: 'SET inventory=:inventory, update_time=:update_time',
      ExpressionAttributeValues: {':inventory': JSON.stringify(updatedInventory), ':update_time': update_time}
    });

    const withPrices = updatedInventory.map((item) => ({...item, prices: prices[item.market_hash_name].price}));
    await client.send(command);
    return res.status(200).json({statusCode: 200, inventory: JSON.stringify(withPrices)});
  } catch (error) {
    const responsePrices = await axios.get(FETCH_PRICES_URL);
    const prices = responsePrices && responsePrices.data && responsePrices.data.items_list;
    const command = createCommand({steamid});

    const response = await docClient.send(command);
    if (response.Item && response.Item.inventory) {
      const inventory = JSON.parse(response.Item.inventory);
      const update_time = JSON.parse(response.Item.update_time) || '';
      const withPrices = inventory.map((item) => ({...item, prices: prices[item.market_hash_name].price}));
      return res.json({statusCode: 201, update_time, inventory: JSON.stringify(withPrices)});
    }
    return res.status(400).json({error, inventory: []});
  }
});

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
