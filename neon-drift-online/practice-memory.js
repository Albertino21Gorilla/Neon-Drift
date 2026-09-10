// Practice mode never loads or exports the offline save or the online balance.
const _1sGsdG = (() => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
})();
