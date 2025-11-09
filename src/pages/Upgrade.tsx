function Upgrade() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800 rounded-lg p-8 md:p-12 shadow-lg border border-gray-700">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Your 7-day trial has ended
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8">
              Thank you for trying BTC Rotator! To continue using the service, please join our waitlist.
            </p>
            <a
              href="mailto:you@btcrotator.com?subject=Join BTC Rotator Waitlist&body=Hi, I'd like to join the BTC Rotator waitlist."
              className="inline-block px-8 py-4 bg-btc-orange hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors text-lg md:text-xl"
            >
              Join the waitlist →
            </a>
            <p className="text-sm text-gray-400 mt-6">
              We'll notify you when paid plans are available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upgrade;

