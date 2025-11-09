import { useState } from 'react';
import { SUPPORTED_TICKERS } from '../constants/tickers';

interface RotationControlsProps {
  currentIndex: number;
  rotationOrder: string[];
  onRotate: () => void;
  onRotateBack: () => void;
  onReorder: (newOrder: string[]) => void;
}

function RotationControls({
  currentIndex,
  rotationOrder,
  onRotate,
  onRotateBack,
  onReorder,
}: RotationControlsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editOrder, setEditOrder] = useState([...rotationOrder]);

  const handleSaveOrder = () => {
    onReorder(editOrder);
    setIsEditing(false);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...editOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setEditOrder(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === editOrder.length - 1) return;
    const newOrder = [...editOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setEditOrder(newOrder);
  };

  const handleReset = () => {
    setEditOrder([...SUPPORTED_TICKERS]);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Rotation Controls</h2>
        <div className="flex gap-2">
          <button
            onClick={onRotateBack}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            ← Previous
          </button>
          <button
            onClick={onRotate}
            className="px-4 py-2 bg-btc-orange hover:bg-orange-600 text-white rounded-lg transition-colors font-semibold"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-300 text-sm mb-2">
          Current: {rotationOrder[currentIndex]} ({currentIndex + 1} of {rotationOrder.length})
        </p>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-white">Rotation Order</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              Edit Order
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSaveOrder}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditOrder([...rotationOrder]);
                }}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {(isEditing ? editOrder : rotationOrder).map((ticker, index) => (
            <div
              key={ticker}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === currentIndex && !isEditing
                  ? 'bg-btc-orange/20 border-2 border-btc-orange'
                  : 'bg-gray-700/50 border border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400 w-8">{index + 1}.</span>
                <span className="font-semibold text-white">{ticker}</span>
                {index === currentIndex && !isEditing && (
                  <span className="px-2 py-1 bg-btc-orange text-white text-xs rounded">
                    Current
                  </span>
                )}
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === editOrder.length - 1}
                    className="px-2 py-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RotationControls;

