module.exports = ({inventory, prices}) => {
  if (prices) {
    return inventory.map((item) => ({...item, prices: prices[item.market_hash_name].price}));
  }
  return inventory;
};
