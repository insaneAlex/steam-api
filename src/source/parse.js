module.exports = (item, descriptions, contextID) => {
  const parsed = {};

  let prop;
  // eslint-disable-next-line no-restricted-syntax
  for (prop in item) {
    // eslint-disable-next-line no-prototype-builtins
    if (item.hasOwnProperty(prop)) {
      parsed[prop] = item[prop];
    }
  }

  parsed.assetid = parsed.id || parsed.assetid;
  parsed.instanceid = parsed.instanceid || '0';
  parsed.amount = parseInt(parsed.amount, 10);
  parsed.contextid = parsed.contextid || contextID.toString();

  // Merge the description
  if (descriptions) {
    let description;
    for (let i = 0; i < descriptions.length; i++) {
      if (descriptions[i].classid === parsed.classid && descriptions[i].instanceid === parsed.instanceid) {
        description = descriptions[i];
        break;
      }
    }
    if (description) {
      // eslint-disable-next-line no-restricted-syntax
      for (prop in description) {
        // eslint-disable-next-line no-prototype-builtins
        if (description.hasOwnProperty(prop)) parsed[prop] = description[prop];
      }
    }
  }

  parsed.is_currency = !!parsed.is_currency;
  parsed.tradable = !!parsed.tradable;
  parsed.marketable = !!parsed.marketable;
  parsed.commodity = !!parsed.commodity;
  parsed.market_tradable_restriction = parsed.market_tradable_restriction ? parseInt(parsed.market_tradable_restriction, 10) : 0;
  parsed.market_marketable_restriction = parsed.market_marketable_restriction ? parseInt(parsed.market_marketable_restriction, 10) : 0;
  parsed.fraudwarnings = parsed.fraudwarnings || [];
  parsed.descriptions = parsed.descriptions || [];

  if (parsed.owner && JSON.stringify(parsed.owner) === '{}') {
    parsed.owner = null;
  }

  return parsed;
};
