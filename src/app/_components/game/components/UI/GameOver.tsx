interface GameOverProps {
  score: number;
  onRestart: () => void;
}

export function GameOver({ score, onRestart }: GameOverProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl text-center max-w-md mx-4">
        <h2 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-4">
          Game Over
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-2">
          No more valid moves!
        </p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Final Score:{" "}
          <span className="text-blue-600 dark:text-blue-400">{score}</span>
        </p>
        <button
          onClick={onRestart}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
