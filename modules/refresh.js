// Ponto central para chamar refreshAll() sem criar dependências circulares.
// app.js regista a função; qualquer módulo pode chamar refreshAll().

let _fn = () => {};
export function setRefreshAll(fn) { _fn = fn; }
export function refreshAll()      { _fn(); }
