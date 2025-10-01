export const Score = ({
  score,
  highScore,
}: {
  score: number;
  highScore: number;
}) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black bg-opacity-50 text-white px-6 py-3 rounded-lg font-mono">
      <div className="text-lg text-center">
        Score: <span className="font-bold">{score}</span>
      </div>
      <div className="text-sm text-center text-yellow-300 mt-1">
        High Score: <span className="font-bold">{highScore}</span>
      </div>
    </div>
  );
};
