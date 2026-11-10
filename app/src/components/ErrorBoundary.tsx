import { Component, type ReactNode } from 'react';

type State = { error: Error | null };

/** Keeps one broken screen from blanking the whole app. Resets when `resetKey` changes (route change). */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidUpdate(prev: { resetKey: string }) {
        if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
    }

    componentDidCatch(error: Error) {
        console.error('screen crashed', error);
        // After an update, an open window may ask for a screen file that no longer exists.
        // Reload once to pick up the new build instead of showing an error.
        if (/dynamically imported module|Importing a module script failed/i.test(error.message)) {
            try {
                if (!sessionStorage.getItem('watch.reloadedForUpdate')) {
                    sessionStorage.setItem('watch.reloadedForUpdate', '1');
                    location.reload();
                }
            } catch {
                /* ignore */
            }
        }
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <main className="page page-pad" style={{ textAlign: 'center' }}>
                <h1 className="page-title">Something went wrong on this screen</h1>
                <p style={{ color: 'var(--mute)' }}>{this.state.error.message}</p>
                <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
                    Try again
                </button>
            </main>
        );
    }
}
