function Disclaimer() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="max-w-3xl w-full">
        <div className="bg-gray-800 rounded-lg p-8 md:p-12 shadow-lg border border-gray-700">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">
            Disclaimer
          </h1>
          
          <div className="space-y-6 text-gray-300 text-lg leading-relaxed">
            <p>
              <strong className="text-white font-bold">BTC Rotator is for ENTERTAINMENT PURPOSES ONLY.</strong>
            </p>
            
            <p>
              <strong className="text-white font-bold">Not financial advice. No guarantees. You may lose money.</strong>
            </p>
            
            <p>
              <strong className="text-white font-bold">Operator is not a registered investment advisor. Use at your own risk.</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Disclaimer;

