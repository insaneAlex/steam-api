const axios = require('axios');
const parseItem = require('./parse');

const InventoryApi = {
  get({
    appid,
    contextid,
    steamid,
    start,
    result,
    count = 1000,
    retries = 1,
    retryDelay = 100,
    language = 'english',
    tradable = true,
    retryFn = () => true
  }) {
    if (this.recentRotations >= this.maxUse) {
      return Promise.reject(new Error('Too many requests'));
    }

    const url = `http://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}?l=${language}&count=${count}`;

    this.recentRequests += 1;

    const makeRequest = () =>
      axios
        .get(url)
        .then((res) => {
          const {data} = res;
          result = this.parse(data, result, contextid, tradable);
        })
        .catch((err) => {
          console.log('Retry error', err);
          if (retries > 1) {
            // eslint-disable-next-line no-promise-executor-return
            return new Promise((resolve) => setTimeout(resolve, retryDelay)).then(() => makeRequest);
          }
          throw new Error(err);
        });

    return makeRequest().then(() => {
      if (result.items.length < result.total && retryFn(result)) {
        start = result.items[result.items.length - 1].assetid;
        return this.get({
          appid,
          contextid,
          steamid,
          start,
          result,
          retries,
          retryDelay,
          language,
          tradable
        });
      }

      return result;
    });
  },
  parse(res, progress, contextid, tradable) {
    const parsed = progress || {
      items: [],
      total: 0
    };

    if (res.success && res.total_inventory_count === 0) return parsed;
    if (!res || !res.success || !res.assets || !res.descriptions) {
      throw new Error('Malformed response');
    }

    parsed.total = res.total_inventory_count;

    Object.values(res.assets).forEach((item) => {
      const parsedItem = parseItem(item, res.descriptions, contextid);
      if (!tradable || parsedItem.tradable) {
        parsed.items.push(parsedItem);
      } else {
        parsed.total--;
      }
    });

    return parsed;
  }
};
module.exports = InventoryApi;
