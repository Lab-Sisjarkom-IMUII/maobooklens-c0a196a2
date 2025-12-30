import './page.css';

export default function Home() {
  return (
    <main className="page-container">
      <div className="page-wrapper">
        <div className="page-content">
          {/* IM-UII Header */}
          <div className="page-header">
            <h1 className="page-title">IM-UII</h1>
            <p className="page-subtitle">Welcome to my Project</p>
          </div>  
          {/* Feature Cards */}
          <div className="page-features">
            <div className="page-card">
              <div className="page-icon">🚀</div>
              <h3 className="page-card-title">Fast Development</h3>
              <p className="page-card-text">
                Built with Next.js for optimal performance and exceptional developer experience
              </p>
            </div>
            
            <div className="page-card">
              <div className="page-icon">🔧</div>
              <h3 className="page-card-title">Easy Deployment</h3>
              <p className="page-card-text">
                Configured with IM-UII for seamless deployment workflow and automation
              </p>
            </div>
            
            <div className="page-card">
              <div className="page-icon">⚡</div>
              <h3 className="page-card-title">Modern Stack</h3>
              <p className="page-card-text">
                Powered by the latest React and cutting-edge tooling
              </p>
            </div>
          </div>

          {/* Quick Start */}
          <div className="page-quick-start">
            <h3 className="page-quick-start-title">Quick Start</h3>
            <div className="page-commands">
              <div className="page-command-row">
                <span className="page-command-label">Install</span>
                <code className="page-command-code">npm install</code>
              </div>
              <div className="page-command-row">
                <span className="page-command-label">Dev server</span>
                <code className="page-command-code">npm run dev</code>
              </div>
              <div className="page-command-row">
                <span className="page-command-label">Build</span>
                <code className="page-command-code">npm run build</code>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="page-footer">
            <p className="page-footer-text">
              Powered by <span className="page-footer-brand">IM-UII</span>
            </p>
            <p className="page-footer-text">Deploy with confidence ✨</p>
          </div>
        </div>
      </div>
    </main>
  );
}