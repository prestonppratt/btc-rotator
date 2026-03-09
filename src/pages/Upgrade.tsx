function Upgrade() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="max-w-xl w-full">
        <div className="bg-[#1C1C1E] rounded-2xl p-8 md:p-12 shadow-premium border border-gray-800">
          <div className="text-center">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white mb-4">
              Your 7-day trial has ended
            </h1>
            <p className="text-base md:text-lg text-gray-400 mb-8 mx-auto max-w-sm">
              Thank you for trying BTC Rotator. To continue using the service, please join our waitlist.
            </p>
            <a
              href="mailto:you@btcrotator.com?subject=Join BTC Rotator Waitlist&body=Hi, I'd like to join the BTC Rotator waitlist."
              className="inline-block px-8 py-3.5 bg-[#0A84FF] hover:bg-[#0066CC] text-white font-medium rounded-xl transition-colors shadow-sm"
            >
              Join the Waitlist
            </a>
            <p className="text-sm text-gray-500 mt-8">
              We'll notify you when paid plans are available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Upgrade;

