let confirmAsk = null;

export function setConfirmAsk(fn) {
  confirmAsk = typeof fn === "function" ? fn : null;
}

export function confirmAction(message, options = {}) {
  if (!confirmAsk) return Promise.resolve(window.confirm(message));
  return confirmAsk(message, options);
}
