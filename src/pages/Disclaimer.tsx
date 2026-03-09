function Disclaimer() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="bg-[#1C1C1E] rounded-2xl p-8 md:p-12 shadow-premium border border-gray-800">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white mb-8 text-center">
            Disclaimer
          </h1>

          <div className="space-y-6 text-gray-400 text-lg leading-relaxed">
            <p>
              <strong className="text-white font-semibold">BTC Rotator is for ENTERTAINMENT PURPOSES ONLY.</strong>
            </p>

            <p>
              <strong className="text-white font-semibold">Not financial advice. No guarantees. You may lose money.</strong>
            </p>

            <p>
              <strong className="text-white font-semibold">Operator is not a registered investment advisor. Use at your own risk.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Disclaimer;

