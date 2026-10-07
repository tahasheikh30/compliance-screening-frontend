import { Component } from "react";

/**
 * Without this, an uncaught error while RENDERING (as opposed to a failed
 * fetch, which components handle themselves via ErrorBanner) unmounts the
 * entire React tree and the person sees a blank white page with no way back.
 * This catches that, shows what broke, and offers a reset that clears local
 * component state without losing their access key or reloading the whole app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error(
      "Render error caught by ErrorBoundary:",
      error,
      info?.componentStack,
    );
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="workspace workspace-single">
        <section className="sheet" role="alert">
          <div className="folder-tab">Error</div>
          <h1>Something went wrong displaying this</h1>
          <p className="lead">
            The rest of the tool is unaffected, and your access key is still
            valid.
          </p>
          <p className="notice notice-bad">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </section>
      </div>
    );
  }
}
