const storage = new Map();

module.exports = {
  setItem: jest.fn(async (key, value) => {
    storage.set(key, value);
    return Promise.resolve();
  }),
  getItem: jest.fn(async (key) => {
    return Promise.resolve(storage.has(key) ? storage.get(key) : null);
  }),
  removeItem: jest.fn(async (key) => {
    storage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(async () => {
    storage.clear();
    return Promise.resolve();
  }),
  // expose internals for tests
  __INTERNAL_MOCK_STORAGE: storage,
};

