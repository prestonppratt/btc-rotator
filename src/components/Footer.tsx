import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="bg-gray-900 border-t border-gray-700 mt-auto">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
            BTC Rotator © {new Date().getFullYear()}
          </div>
          <div className="flex gap-4 sm:gap-6">
            <Link
              to="/disclaimer"
              className="text-xs sm:text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

