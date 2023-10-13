module.exports = ({tags, tagName}) => tags.find((el) => el.category === tagName) || {};
