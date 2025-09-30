export const Score = ({ score }: { score: number }) => {
  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg font-mono text-lg">
      Score: {score}
    </div>
  );
};
