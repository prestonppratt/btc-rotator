import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-gray-800 mt-auto">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <div className="text-xs sm:text-sm text-gray-500 text-center sm:text-left font-medium">
            BTC Rotator © {new Date().getFullYear()}
          </div>
          <div className="flex gap-4 sm:gap-6">
            <Link
              to="/disclaimer"
              className="text-xs sm:text-sm text-gray-500 hover:text-white transition-colors font-medium"
            >
              Disclaimer
            </Link>
            <a
              href="https://www.peerrotator.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              Community
            </a>
            <a
              href="https://chat.whatsapp.com/J485np70u9NBCGbE6rjRKe"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-xs sm:text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              {/* WhatsApp Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 512"
                fill="currentColor"
                className="w-4 h-4 mr-1"
              >
                <path d="M380.9 97.1C339-0 255.9-0 214 97.1c-41.9 97.1-41.9 203.6 0 300.7 41.9 97.1 125 97.1 166.9 0 41.9-97.1 41.9-203.6 0-300.7zM224 384c-88.4 0-160-71.6-160-160S135.6 64 224 64s160 71.6 160 160-71.6 160-160 160zm-32-96h64c8.8 0 16-7.2 16-16v-64c0-8.8-7.2-16-16-16h-64c-8.8 0-16 7.2-16 16v64c0 8.8 7.2 16 16 16z" />
              </svg>
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

