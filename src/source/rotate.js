module.exports = (arr, repeat) => {
  let pos = 0;
  let repeats = 0;
  return () => {
    if (pos > arr.length - 1) pos = 0;
    if (repeats >= repeat) {
      repeats = 0;
      // eslint-disable-next-line no-plusplus
      return arr[pos++];
    }
    // eslint-disable-next-line no-plusplus
    repeats++;
    return arr[pos];
  };
};
