import { Component } from 'react'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Route render failed:', error, info)
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
          <div className="border border-red-700 bg-red-950/20 max-w-xl p-6 text-center">
            <h1 className="heist-font text-4xl text-red-500 tracking-widest m-0">SYSTEM FAULT</h1>
            <p className="heist-mono text-xs text-gray-400 uppercase tracking-widest mt-4">
              Reload the terminal or contact the admin desk.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
