// kv/config_store.js
export default {
  async get(key) {
    return await CONFIG_KV.get(key);
  },
  async put(key, value) {
    await CONFIG_KV.put(key, value);
  },
  async delete(key) {
    await CONFIG_KV.delete(key);
  }
};
