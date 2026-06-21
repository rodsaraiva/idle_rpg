// Mock superficial: fonte nunca carrega -> prova o caminho de fallback gracioso.
module.exports = {
  useFonts: () => [false, null],
  loadAsync: () => Promise.resolve(),
};
