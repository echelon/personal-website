// Compiled and served only by the local dev server; never part of the site bundle.
const script = document.currentScript;
if (script instanceof HTMLScriptElement) {
  const revision = script.dataset.revision;
  let events: EventSource;
  const connect = () => {
    events = new EventSource('/__sitegen/events');
    events.onmessage = ({ data }) => {
      if (data !== revision) {
        events.close();
        window.location.reload();
      }
    };
  };
  connect();
  window.addEventListener('pagehide', () => events.close());
  window.addEventListener('pageshow', event => { if (event.persisted) connect(); });
}
