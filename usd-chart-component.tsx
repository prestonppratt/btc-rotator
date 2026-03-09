{/* All Assets - USD Price Chart */ }
<div className="glass-panel rounded-lg p-3 sm:p-4 md:p-6 shadow-lg mt-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">
                All Assets - Unit Price ($)
            </h2>
            <p className="text-xs text-gray-400 mt-1">
                Historical price of 1 unit of each asset denominated in USD
            </p>
        </div>
        <div className="flex gap-2">
            {(['1mo', '3mo', '6mo', '1y'] as const).map((tf) => (
                <button
                    key={tf}
                    onClick={() => setSelectedUSDAssetsTimeframe(tf)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${selectedUSDAssetsTimeframe === tf
                        ? 'bg-primary text-white font-bold'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                >
                    {tf}
                </button>
            ))}
        </div>
    </div>

    {/* USD Asset Selection */}
    <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-xs text-gray-400 mb-2">Select assets to display:</p>
        <div className="flex flex-wrap gap-3">
            {SUPPORTED_TICKERS.map((ticker) => (
                <label key={ticker} className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={selectedUSDAssetsToDisplay.includes(ticker)}
                        onChange={(e) => {
                            if (e.target.checked) {
                                setSelectedUSDAssetsToDisplay([...selectedUSDAssetsToDisplay, ticker]);
                            } else {
                                setSelectedUSDAssetsToDisplay(selectedUSDAssetsToDisplay.filter(t => t !== ticker));
                            }
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary focus:ring-primary focus:ring-offset-gray-900"
                    />
                    <span className="text-sm text-gray-300">
                        {TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}
                    </span>
                </label>
            ))}
        </div>
    </div>

    {allAssetsHistoricalData.size === 0 ? (
        <div className="text-center py-8 sm:py-12 text-gray-400 text-sm sm:text-base">
            No historical data available.
        </div>
    ) : (
        <ResponsiveContainer width="100%" height={400}>
            <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                    dataKey="date"
                    type="category"
                    allowDuplicatedCategory={false}
                    stroke="#9CA3AF"
                    style={{ fontSize: '12px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                />
                <YAxis
                    stroke="#9CA3AF"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff',
                        backdropFilter: 'blur(4px)'
                    }}
                    formatter={(value: number, name: string) => {
                        if (typeof value === 'number') {
                            return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, TICKER_NAMES[name as keyof typeof TICKER_NAMES] || name];
                        }
                        return ['N/A', name];
                    }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {(() => {
                    // Filter data based on selected timeframe
                    const cutoffDate = new Date();
                    switch (selectedUSDAssetsTimeframe) {
                        case '1mo':
                            cutoffDate.setMonth(cutoffDate.getMonth() - 1);
                            break;
                        case '3mo':
                            cutoffDate.setMonth(cutoffDate.getMonth() - 3);
                            break;
                        case '6mo':
                            cutoffDate.setMonth(cutoffDate.getMonth() - 6);
                            break;
                        case '1y':
                            cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
                            break;
                    }
                    const cutoffTimestamp = cutoffDate.getTime();

                    // Merge all data into a single array for the chart
                    const mergedDataMap = new Map<string, any>();

                    allAssetsHistoricalData.forEach((data, ticker) => {
                        data.forEach(point => {
                            const timestamp = new Date(point.date).getTime();
                            if (timestamp >= cutoffTimestamp) {
                                const dateKey = point.date;
                                if (!mergedDataMap.has(dateKey)) {
                                    mergedDataMap.set(dateKey, { date: dateKey, timestamp });
                                }
                                const existing = mergedDataMap.get(dateKey);
                                existing[ticker] = point.priceUSD; // Use USD price instead of BTC
                            }
                        });
                    });

                    const mergedData = Array.from(mergedDataMap.values())
                        .sort((a, b) => a.timestamp - b.timestamp);

                    // Filter to show only selected assets
                    const tickersToDisplay = selectedUSDAssetsToDisplay;

                    // If no assets selected, show a message
                    if (tickersToDisplay.length === 0) {
                        return (
                            <text x="50%" y="50%" textAnchor="middle" fill="#9CA3AF" fontSize="14">
                                Select at least one asset to display
                            </text>
                        );
                    }

                    return tickersToDisplay.map((ticker, index) => {
                        // Generate distinct colors
                        const colors = [
                            '#F7931A', // BTC (Orange)
                            '#3B82F6', // Blue
                            '#10B981', // Green
                            '#EF4444', // Red
                            '#8B5CF6', // Purple
                            '#F59E0B', // Amber
                            '#EC4899', // Pink
                            '#06B6D4', // Cyan
                            '#F97316', // Orange
                            '#14B8A6', // Teal
                            '#A855F7', // Violet
                            '#F43F5E', // Rose
                            '#84CC16', // Lime
                            '#06B6D4', // Sky
                            '#F59E0B', // Yellow
                            '#EC4899', // Fuchsia
                        ];
                        const color = ticker === 'BTC-USD' ? '#F7931A' : colors[(index + 1) % colors.length];

                        return (
                            <Line
                                key={ticker}
                                data={mergedData}
                                type="monotone"
                                dataKey={ticker}
                                stroke={color}
                                strokeWidth={ticker === 'BTC-USD' ? 3 : 2}
                                dot={false}
                                name={TICKER_NAMES[ticker as keyof typeof TICKER_NAMES] || ticker}
                                connectNulls={true}
                            />
                        );
                    });
                })()}
            </LineChart>
        </ResponsiveContainer>
    )}
</div>
